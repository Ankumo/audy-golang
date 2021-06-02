package main

import (
	"bufio"
	"bytes"
	"crypto/md5"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/tcolgate/mp3"

	"github.com/dhowden/tag"
	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
)

type AudyTrackProcessingErr struct {
	underlying   error
	underlyingDB *DBWorkerError
	key          string
}

type Validator struct {
	str string
	min int
	max int
}

func (err *AudyTrackProcessingErr) Error() string {
	var errMsg string

	if err.underlying != nil {
		errMsg = err.underlying.Error()
	} else if err.underlyingDB != nil {
		errMsg = err.underlyingDB.Error()
	}

	return fmt.Sprintf("Processing error occurred! Key: %v\n%v", err.key, errMsg)
}

func genHash() string {
	salt := ""

	rand.Seed(time.Now().UnixNano())

	for i := 0; i < 20; i++ {
		salt = fmt.Sprint(salt, string(rand.Intn(93)+33))
	}

	h := sha1.New()
	h.Write([]byte(salt))

	return hex.EncodeToString(h.Sum(nil))
}

func md5String(str string) string {
	h := md5.New()
	h.Write([]byte(str))

	return hex.EncodeToString(h.Sum(nil))
}

func md5File(r *bufio.Reader) string {
	h := md5.New()

	r.WriteTo(h)
	return hex.EncodeToString(h.Sum(nil))
}

func buildResponse(key, err string, data interface{}) *gin.H {
	success := true

	if len(key) > 0 || len(err) > 0 {
		success = false
	}

	return &gin.H{
		"key":     key,
		"error":   err,
		"success": success,
		"data":    data,
	}
}

func sendErr(c *gin.Context, key, err string) {
	c.JSON(200, buildResponse(key, err, nil))
}

func sendErrAndPrint(c *gin.Context, key, err string) {
	fmt.Println(err)
	sendErr(c, key, err)
}

func sendValidationError(c *gin.Context, input string, err error) {
	sendErr(c, "validation", fmt.Sprint(input, "\n", err.Error()))
}

func sendDBErrorAndPrint(c *gin.Context, dbErr *DBWorkerError) {
	sendErrAndPrint(c, "db", dbErr.Error())
}

func sendRes(c *gin.Context, data interface{}) {
	c.JSON(200, buildResponse("", "", data))
}

func sendSuccess(c *gin.Context) {
	sendRes(c, "")
}

func (u *DBUser) check(c *gin.Context) bool {
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return false
	}

	return true
}

func (u *DBUser) checkAdmin(c *gin.Context) bool {
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return false
	}

	if !u.IsAdmin {
		sendErr(c, "not_admin", "")
		return false
	}

	return true
}

func (u *DBUser) checkRoot(c *gin.Context) bool {
	if u == nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return false
	}

	if u.login != config.RootUser {
		sendErr(c, "not_root", "")
		return false
	}

	return true
}

func loadLib() {
	library, err := db.GetTracks()

	if err != nil {
		log.Fatal(err.Error())
	}

	lib = library

	if _, err := os.Stat("db/music"); os.IsNotExist(err) {
		os.Mkdir("db/music", os.ModePerm)
		db.ClearLib()
		lib = make(map[string]*DBTrack, 0)
		libJSONCache = "[]"
		fmt.Println("Music folder was not found. All music data wiped")
		return
	}

	for k, t := range lib {
		trackPath := fmt.Sprint("db/music/", k, "/track")

		if _, err := os.Stat(trackPath); os.IsNotExist(err) {
			fmt.Printf("Track %v not found at path %v. Removing from db...\n", fmt.Sprint(t.Artist, " - ", t.Title), trackPath)
			db.RemoveTrack(k)
			delete(lib, k)

			continue
		}
	}

	fmt.Printf("Music data loaded successfully. Found %v tracks\n", len(lib))

	updateLibCache()
}

func loadConfig() {
	configPath := "db/config.json"
	_, err := os.Stat(configPath)

	if os.IsNotExist(err) {
		newConfigBytes, err := json.MarshalIndent(&config, "", "\t")

		if err != nil {
			log.Fatalf("Unable to save default config to %v: %v\n", configPath, err.Error())
		} else {
			ioutil.WriteFile(configPath, newConfigBytes, os.ModePerm)
		}
		return
	}

	f, err := os.OpenFile(configPath, os.O_RDONLY, os.ModePerm)

	if err != nil {
		fmt.Printf("Error while loading config %v: %v\n", configPath, err.Error())
		return
	}

	defer f.Close()
	bytes, err := ioutil.ReadAll(f)

	if err != nil {
		fmt.Printf("error while loading config %v: %v\n", configPath, err.Error())
		return
	}

	err = json.Unmarshal(bytes, &config)

	if err != nil {
		fmt.Printf("Error while loading config %v: %v\n", configPath, err.Error())
		return
	}
}

func saveConfig() error {
	configPath := "db/config.json"

	file, err := os.Create(configPath)

	if err != nil {
		fmt.Printf("Unable to create new config file: %v", err.Error())
		return err
	}

	configBytes, err := json.MarshalIndent(config, "", "\t")
	if err != nil {
		fmt.Printf("Unable to parse config to json: %v", err.Error())
		return err
	}

	file.Write(configBytes)
	return nil
}

func parseTrackFileName(name string) (string, string) {
	var artist, title string = "?", "?"

	if strings.HasSuffix(name, ".mp3") {
		name = name[:len(name)-4]
	}

	parts := strings.SplitN(name, "-", 2)

	if len(parts) == 1 {
		title = parts[0]
	} else {
		artist = strings.TrimSpace(parts[0])
		title = strings.TrimSpace(parts[1])
	}

	return artist, title
}

func processTrack(path, fileName string) (*DBTrack, *AudyTrackProcessingErr) {
	f, err := os.OpenFile(path, os.O_RDONLY, os.ModePerm)

	if err != nil {
		return nil, &AudyTrackProcessingErr{err, nil, fmt.Sprint("open_file")}
	}

	id3, err := tag.ReadFrom(f)

	if err == nil {
		if id3.FileType() != tag.MP3 {
			f.Close()
			return nil, &AudyTrackProcessingErr{nil, nil, "not_mp3"}
		}
	}

	_, err = f.Seek(0, 0)

	if err != nil {
		f.Close()
		return nil, &AudyTrackProcessingErr{err, nil, "seek_file"}
	}

	fileReader := bufio.NewReaderSize(f, 1024*1024)

	hash := md5File(fileReader)
	if len(hash) == 0 {
		f.Close()
		return nil, &AudyTrackProcessingErr{nil, nil, "no_hash"}
	}

	t, _ := db.GetTrack(hash)

	if t != nil {
		f.Close()
		os.Remove(path)
		return nil, &AudyTrackProcessingErr{nil, nil, "already_exists"}
	}

	_, err = f.Seek(0, 0)

	if err != nil {
		f.Close()
		return nil, &AudyTrackProcessingErr{err, nil, "seek_file"}
	}

	duration, err := calcTrackDuration(fileReader)
	f.Close()

	if err != nil {
		return nil, &AudyTrackProcessingErr{err, nil, "get_duration"}
	}

	newDirPath := fmt.Sprint("db/music/", hash)

	if _, err := os.Stat(newDirPath); os.IsNotExist(err) {
		os.Mkdir(newDirPath, os.ModePerm)
	}

	newPath := fmt.Sprint(newDirPath, "/track")

	if _, err := os.Stat(newPath); os.IsExist(err) {
		os.Remove(newPath)
	}

	err = os.Rename(path, fmt.Sprint(newPath))
	if err != nil {
		os.RemoveAll(newPath)
		os.Remove(path)
		return nil, &AudyTrackProcessingErr{err, nil, "move_file"}
	}

	artist, title := parseTrackFileName(fileName)

	newTrack := &DBTrack{
		Artist:    artist,
		Title:     title,
		Md5:       hash,
		Timestamp: int(time.Now().Unix()),
		HasImage:  false,
		Duration:  duration,
	}

	newErr := processAlbumPicture(newDirPath, id3)

	if newErr != nil {
		if newErr.underlying != nil {
			fmt.Print(newErr.Error())
		}
	} else {
		newTrack.HasImage = true
	}

	_, dbErr := db.AddTrack(newTrack)

	if dbErr != nil {
		os.RemoveAll(newDirPath)
		return nil, &AudyTrackProcessingErr{nil, dbErr, ""}
	}

	return newTrack, nil
}

func processAlbumPicture(dirPath string, t tag.Metadata) *AudyTrackProcessingErr {
	if t != nil && t.Picture() != nil {
		img, err := imaging.Decode(bytes.NewReader(t.Picture().Data))

		if err != nil {
			return &AudyTrackProcessingErr{err, nil, fmt.Sprint("trying to decode album picture")}
		}

		size := img.Bounds().Size()

		if size.X > 350 || size.Y > 350 {
			img = imaging.Resize(img, 350, 350, imaging.Lanczos)
		}

		newPicPath := fmt.Sprint(dirPath, "/image.jpg")

		if _, err = os.Stat(newPicPath); os.IsExist(err) {
			os.Remove(newPicPath)
		}

		err = imaging.Save(img, newPicPath, imaging.JPEGQuality(80))

		if err != nil {
			return &AudyTrackProcessingErr{err, nil, fmt.Sprint("trying to save resized album picture")}
		}
	} else {
		return &AudyTrackProcessingErr{nil, nil, "image_not_found"}
	}

	return nil
}

func processVkTrack(f *os.File, path string, track *VkTrack) (*DBTrack, *AudyTrackProcessingErr) {
	id3, err := tag.ReadFrom(f)

	if err == nil {
		if id3.FileType() != tag.MP3 {
			f.Close()
			return nil, &AudyTrackProcessingErr{nil, nil, "not_mp3"}
		}
	}

	_, err = f.Seek(0, 0)

	if err != nil {
		f.Close()
		return nil, &AudyTrackProcessingErr{err, nil, "unable to seek through file"}
	}

	fileReader := bufio.NewReaderSize(f, 1024*1024)

	hash := md5File(fileReader)
	if len(hash) == 0 {
		f.Close()
		return nil, &AudyTrackProcessingErr{nil, nil, "no_hash"}
	}

	t, _ := db.GetTrack(hash)

	if t != nil {
		f.Close()
		return nil, &AudyTrackProcessingErr{nil, nil, "already_exists"}
	}

	newDirPath := fmt.Sprint("db/music/", hash)
	f.Close()

	if _, err := os.Stat(newDirPath); os.IsNotExist(err) {
		os.Mkdir(newDirPath, os.ModePerm)
	}

	newPath := fmt.Sprint(newDirPath, "/track")

	if _, err := os.Stat(newPath); os.IsExist(err) {
		os.Remove(newPath)
	}

	err = os.Rename(path, fmt.Sprint(newPath))
	if err != nil {
		os.RemoveAll(newDirPath)
		os.Remove(path)
		return nil, &AudyTrackProcessingErr{err, nil, "trying to move file"}
	}

	newTrack := &DBTrack{
		Artist:    track.Artist,
		Title:     track.Title,
		Md5:       hash,
		Timestamp: int(time.Now().Unix()),
		HasImage:  false,
		Duration:  float32(track.Duration),
	}

	newErr := processAlbumPicture(newDirPath, id3)

	if newErr != nil {
		if newErr.underlying != nil {
			fmt.Print(newErr.Error())
		}
	} else {
		newTrack.HasImage = true
	}

	_, dbErr := db.AddTrack(newTrack)

	if dbErr != nil {
		os.RemoveAll(newDirPath)
		return nil, &AudyTrackProcessingErr{nil, dbErr, ""}
	}

	return newTrack, nil
}

func genPassword() string {
	salt := ""

	rand.Seed(time.Now().UnixNano())

	for i := 0; i < 9; i++ {
		salt = fmt.Sprint(salt, string(rand.Intn(26)+97))
	}

	return salt
}

func removeUnusedMusic() {
	musicLibPath := "db/music"

	if fi, err := os.Stat(musicLibPath); os.IsNotExist(err) || !fi.IsDir() {
		return
	}

	libMap := make(map[string]int, 0)
	files, err := ioutil.ReadDir(musicLibPath)

	if err != nil {
		fmt.Printf("Error while checking unused music: %v\n", err.Error())
		return
	}

	for _, f := range files {
		if !f.IsDir() {
			continue
		}

		libMap[f.Name()] = 0
	}

	for _, s := range lib {
		if _, ok := libMap[s.Md5]; ok {
			delete(libMap, s.Md5)
		}
	}

	if len(libMap) > 0 {
		fmt.Printf("Found %v unused music. Removing...\n", len(libMap))

		for k := range libMap {
			os.RemoveAll(fmt.Sprint(musicLibPath, "/", k))
		}
	}
}

func calcTrackDuration(r io.Reader) (float32, error) {
	d := mp3.NewDecoder(r)

	var duration float32 = 0.0
	var frame mp3.Frame
	skipped := 0

	for {
		if err := d.Decode(&frame, &skipped); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				break
			}

			return duration, err
		}

		duration = duration + float32(frame.Duration().Seconds())
	}

	return duration, nil
}

func genId() string {
	id := ""
	alph := "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

	for i := 0; i <= 20; i++ {
		id = fmt.Sprint(id, alph[rand.Intn(len(alph))])
	}

	return id
}

func (cl *AudyChanListener) SendMessage(msg *gin.H) {
	cl.Channel <- msg
}

func SendMessageAll(msg *gin.H) {
	for _, v := range channels {
		v.Channel <- msg
	}
}

func updateLibCache() {
	json, _ := json.Marshal(&lib)
	libJSONCache = string(json)
}

func nv(str string, ranges ...int) *Validator {
	if len(ranges) == 0 {
		return &Validator{str, 0, math.MaxInt32}
	} else if len(ranges) == 1 {
		return &Validator{str, ranges[0], math.MaxInt32}
	}

	return &Validator{str, ranges[0], ranges[1]}
}

func validate(v *Validator) error {
	if len(v.str) >= v.min && len(v.str) <= v.max {
		return nil
	}

	return errors.New(fmt.Sprintf("The length of given string \"%v\" must be in range between %v and %v", v.str, v.min, v.max))
}

func validateMany(valids ...*Validator) error {
	for _, v := range valids {
		err := validate(v)

		if err != nil {
			return err
		}
	}

	return nil
}

var allowedThemeKeys map[string]string = map[string]string{
	"--text-primary":                     "",
	"--text-primary-active":              "",
	"--text-secondary":                   "",
	"--text-secondary-active":            "",
	"--text-active":                      "",
	"--bg-primary":                       "",
	"--bg-secondary":                     "",
	"--main-bg-primary":                  "",
	"--main-bg-secondary":                "",
	"--bg-context":                       "",
	"--scrollbar-bg":                     "",
	"--scrollbar-thumb":                  "",
	"--scrollbar-thumb-hover":            "",
	"--main-bg":                          "",
	"--main-bg-whiteboard":               "",
	"--divider":                          "",
	"--alert-bg":                         "",
	"--alert-text":                       "",
	"--alert-info-text":                  "",
	"--alert-warning-text":               "",
	"--alert-error-text":                 "",
	"--loading-bg":                       "",
	"--loading-text":                     "",
	"--modal-bg":                         "",
	"--modal-fade":                       "",
	"--avatar-hover":                     "",
	"--settings-bg":                      "",
	"--music-seekbar-bg":                 "",
	"--music-seekbar-buffer":             "",
	"--music-seekbar-progress":           "",
	"--frame":                            "",
	"--frame-active":                     "",
	"--warning":                          "",
	"--success":                          "",
	"--danger":                           "",
	"--info":                             "",
	"--bg-filter":                        "",
	"--svg-filter":                       "",
	"--svg-filter-invert":                "",
	"--upload-table-icon-success-filter": "",
	"--upload-table-icon-error-filter":   "",
	"--upload-table-icon-warning-filter": "",
	"--seekbar-buffer-blend-mode":        "",
	"--seekbar-progress-blend-mode":      "",
}

func validateThemeKeys(theme AudyTheme) bool {
	for k := range theme.Colors {
		if _, ok := allowedThemeKeys[k]; !ok {
			return false
		}
	}

	for k := range theme.Vars {
		if _, ok := allowedThemeKeys[k]; !ok {
			return false
		}
	}

	return true
}
