package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
)

type AudyHandlers struct{}

type AudyChanListener struct {
	Channel      chan interface{}
	User         *DBUser
	ChCtx        *gin.Context
	Id           string
	Disconnected bool
}

type AudyTheme struct {
	Name   string            `json:"name"`
	Id     string            `json:"id"`
	Colors map[string]string `json:"colors"`
	Vars   map[string]string `json:"vars"`
}

const sampleRate int = 48000
const chunkSize int64 = 1024 * 500

var ftpUploadInProcess bool = false

var channels map[int]*AudyChanListener = make(map[int]*AudyChanListener, 0)

func R_music(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	c.Header("Connection", "keep-alive")
	c.Header("Content-Type", "audio/mpeg")
	c.Header("Accept-Ranges", "bytes")

	filePath := fmt.Sprint("db/music/", c.Param("file"), "/track")

	fi, err := os.Stat(filePath)

	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	f, err := os.OpenFile(filePath, os.O_RDONLY, os.ModePerm)

	if err != nil {
		fmt.Printf("error while opening file %v: %v\n", filePath, err.Error())
		return
	}

	defer f.Close()

	if err != nil {
		fmt.Printf("error while getting file %v stat: %v", filePath, err.Error())
		return
	}

	rangeHeader := c.Request.Header.Get("Range")
	rangeHeader = strings.Replace(rangeHeader, "bytes=", "", -1)

	parts := strings.Split(rangeHeader, "-")
	var bytes0, bytes1 int64 = 0, fi.Size()

	if len(parts) == 2 {
		bytes0, err = strconv.ParseInt(parts[0], 10, 64)

		if err != nil {
			fmt.Printf("error while parsing byte range 0 (%v): %v\n", parts[0], err.Error())
			c.Status(http.StatusInternalServerError)
			return
		}

		if len(parts[1]) > 0 {
			bytes1, err = strconv.ParseInt(parts[1], 10, 64)

			if err != nil {
				fmt.Printf("error while parsing byte range 1 (%v): %v\n", parts[1], err.Error())
				c.Status(http.StatusInternalServerError)
				return
			}
		}
	}

	diff := bytes1 - bytes0

	if diff < 0 {
		fmt.Printf("byte range 0 is higher than 1 (%v)\n", parts)
		c.Status(http.StatusInternalServerError)
		return
	} else if diff > chunkSize {
		diff = chunkSize
		bytes1 = bytes0 + chunkSize
	}

	bufSize := sampleRate

	if diff < int64(sampleRate) {
		bufSize = int(diff)
	}

	if bytes1 == fi.Size() {
		bytes1--
	}

	c.Header("Content-Length", fmt.Sprint(diff))
	c.Header("Content-Range", fmt.Sprintf("bytes %v-%v/%v", bytes0, bytes1, fi.Size()))

	f.Seek(bytes0, 0)

	reader := bufio.NewReaderSize(io.LimitReader(f, diff), bufSize)

	c.Status(http.StatusPartialContent)
	c.Stream(func(w io.Writer) bool {
		reader.WriteTo(w)
		return false
	})
}

func R_upload(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	trackFile, err := c.FormFile("track")

	if err != nil {
		sendErrAndPrint(c, "no_file", err.Error())
		return
	}

	if !strings.HasSuffix(strings.ToLower(trackFile.Filename), ".mp3") {
		sendErr(c, "unsupported_format", "Uploaded file was not in .mp3 extension")
		return
	}

	if _, err = os.Stat("upload"); os.IsNotExist(err) {
		os.Mkdir("upload", os.ModePerm)
		os.Mkdir("upload/ftp_upload", os.ModePerm)
	}

	filePath := fmt.Sprint("upload/", trackFile.Filename)
	c.SaveUploadedFile(trackFile, filePath)

	track, procErr := processTrack(filePath, trackFile.Filename)

	if procErr != nil {
		sendErr(c, procErr.key, procErr.Error())
		return
	}

	lib[track.Md5] = track

	updateLibCache()

	SendMessageAll(&gin.H{
		"type": "track_add",
		"data": &gin.H{
			"track": track,
		},
	})

	sendSuccess(c)
}

func R_ftpupload(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	if ftpUploadInProcess {
		sendErr(c, "ftp_upload_already_in_process", "")
		return
	}

	files := make([]os.FileInfo, 0)
	rawFiles, err := ioutil.ReadDir("upload/ftp_upload")

	if err != nil {
		sendErrAndPrint(c, "ftp_upload_dir_read", fmt.Sprintf("Error while trying to read ftp_upload dir: %v\n", err.Error()))
		return
	}

	if _, err := os.Stat("db/music"); os.IsNotExist(err) {
		os.Mkdir("db/music", os.ModePerm)
	}

	if err != nil {
		sendErrAndPrint(c, "ftp_upload_dir_make", fmt.Sprintf("Error while trying to make not existing music dir: %v\n", err.Error()))
		return
	}

	for _, f := range rawFiles {
		if f.IsDir() || !strings.HasSuffix(strings.ToLower(f.Name()), ".mp3") {
			continue
		}

		files = append(files, f)
	}

	if len(files) == 0 {
		sendErr(c, "ftp_upload_no_files", "")
		return
	}

	var acl *AudyChanListener = nil
	if _, ok := channels[u.ID]; ok {
		acl = channels[u.ID]

		if !acl.Disconnected {
			acl.SendMessage(&gin.H{
				"type": "ftpu_start",
				"data": &gin.H{
					"files": len(files),
				},
			})
		}
	}

	go func() {
		defer loadLib()
		ftpUploadInProcess = true

		for _, file := range files {
			fileName := file.Name()
			path := fmt.Sprint("upload/ftp_upload/", fileName)

			track, procErr := processTrack(path, fileName)
			success := true
			errKey := ""

			if procErr != nil {
				errKey = procErr.key
				success = false
			} else {
				SendMessageAll(&gin.H{
					"type": "track_add",
					"data": &gin.H{
						"track": track,
					},
				})
			}

			if !acl.Disconnected {
				acl.SendMessage(&gin.H{
					"type": "ftpu_file_processed",
					"data": &gin.H{
						"fileName": fileName,
						"key":      errKey,
						"success":  success,
					},
				})
			}
		}

		ftpUploadInProcess = false
		if !acl.Disconnected {
			acl.SendMessage(&gin.H{
				"type": "ftpu_done",
				"data": nil,
			})
		}
	}()

	sendSuccess(c)
}

func R_login(c *gin.Context) {
	u := auth.GetUser(c)

	if u != nil {
		sendErr(c, "already_logged_in", "")
		return
	}

	login := c.PostForm("login")
	password := c.PostForm("password")

	err := validateMany(
		nv(login, 3, 20),
		nv(password, 3, 20),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("login: %v; password: %v", login, strings.Repeat("*", len(password))), err)
		return
	}

	u, dbErr := db.GetUserByCreds(login, md5String(password))

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "incorrect_login_password", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}
		return
	}

	hash := genHash()

	_, dbErr = db.UpdateUserHash(u.ID, hash)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	c.SetCookie("session_hash", hash, config.SessionTime*60*60, "/", "", false, true)
	sendSuccess(c)
}

func R_logout(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	delete(auth.SesCache, u.sessionHash)

	c.SetCookie("session_hash", "", -1, "/", "", false, true)
	sendSuccess(c)
}

func R_updatetrack(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	hash := c.PostForm("hash")
	newArtist := c.PostForm("artist")
	newTitle := c.PostForm("title")

	err := validateMany(
		nv(hash, 1),
		nv(newArtist, 1),
		nv(newTitle, 1),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("hash: %v; artist: %v; title: %v", hash, newArtist, newTitle), err)
		return
	}

	t, dbErr := db.GetTrack(hash)

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "track_not_found", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}
		return
	}

	if t.Artist == newArtist && t.Title == newTitle {
		sendErr(c, "no_changes", "")
		return
	}

	t.Title = newTitle
	t.Artist = newArtist

	_, dbErr = db.AddTrack(t)

	if err != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	lib[t.Md5] = t
	updateLibCache()

	SendMessageAll(&gin.H{
		"type": "track_update",
		"data": &gin.H{
			"hash":   t.Md5,
			"title":  t.Title,
			"artist": t.Artist,
		},
	})

	sendSuccess(c)
}

func R_removetracks(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	hashes := c.PostFormArray("hashes[]")

	if len(hashes) == 0 {
		sendValidationError(c, fmt.Sprintf("hashes: %v", hashes), errors.New("Hashes list was empty"))
		return
	}

	iArray := make([]interface{}, len(hashes))
	for i, v := range hashes {
		iArray[i] = v
	}

	tracks, dbErr := db.GetTracksByHashes(iArray)

	if len(tracks) == 0 {
		sendSuccess(c)
		return
	}

	iArray = make([]interface{}, len(tracks))

	for i, v := range tracks {
		iArray[i] = v.Md5
	}

	_, dbErr = db.RemoveTracks(iArray)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	for _, t := range tracks {
		trackPath := fmt.Sprint("db/music/", t.Md5)
		err := os.RemoveAll(trackPath)

		if err != nil {
			sendErrAndPrint(c, "removing_tracks",
				fmt.Sprintf("An error occurred while trying to remove track %v at path %v: %v\n", fmt.Sprint(t.Artist, " - ", t.Title), trackPath, err.Error()))
			return
		}

		delete(lib, t.Md5)
	}

	updateLibCache()

	SendMessageAll(&gin.H{
		"type": "tracks_remove",
		"data": &gin.H{
			"hashes": iArray,
		},
	})

	sendSuccess(c)
}

func R_setlyrics(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	hash := c.PostForm("hash")
	newLyrics := c.PostForm("lyrics")

	if len(hash) == 0 {
		sendValidationError(c, fmt.Sprintf("hash: %v; lyrics: %v", hash, newLyrics), errors.New("Given hash was empty"))
		return
	}

	t, err := db.GetTrack(hash)

	if err != nil {
		if err.underlying == sql.ErrNoRows {
			sendErr(c, "track_not_found", "")
		} else {
			sendDBErrorAndPrint(c, err)
		}
		return
	}

	if newLyrics == t.Lyrics {
		sendErr(c, "no_changes", "")
		return
	}

	t.Lyrics = newLyrics
	_, err = db.AddTrack(t)

	if err != nil {
		sendDBErrorAndPrint(c, err)
		return
	}

	lib[t.Md5] = t
	updateLibCache()

	SendMessageAll(&gin.H{
		"type": "track_lyrics",
		"data": &gin.H{
			"hash":   hash,
			"lyrics": newLyrics,
		},
	})

	sendSuccess(c)
}

func R_addpl(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newName := c.PostForm("name")
	newTracks := c.PostForm("tracks")

	err := validateMany(
		nv(newName, 1, 30),
		nv(newTracks, 2),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("name: %v; tracks: %v", newName, newTracks), err)
		return
	}

	pl := &DBPlaylist{
		ID:      0,
		Name:    newName,
		ownerID: u.ID,
		Tracks:  newTracks,
	}

	res, dbErr := db.AddPlaylist(pl)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	lastId, _ := res.LastInsertId()
	sendRes(c, int(lastId))
}

func R_removepl(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newID := c.PostForm("id")
	plid, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprint("id: ", newID), errors.New("Given playlist id is not convertable to type integer"))
		return
	}

	pl, dbErr := db.GetPlaylist(plid)

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "playlist_not_found", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}
		return
	}

	if pl.ownerID != u.ID {
		sendErr(c, "playlist_not_found", "")
		return
	}

	if pl.Name == config.AllPlaylistKey {
		sendErr(c, "cannot_remove_apk", "")
		return
	}

	_, dbErr = db.RemovePlaylist(pl.ID)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendSuccess(c)
}

func R_renamepl(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newID := c.PostForm("id")
	newName := c.PostForm("name")

	plID, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("id: %v", newID), err)
		return
	}

	err = validate(nv(newName, 1, 30))

	if err != nil {
		sendValidationError(c, fmt.Sprintf("name: %v", newName), err)
		return
	}

	pl, dbErr := db.GetPlaylist(plID)

	if pl != nil {
		if pl.ownerID != u.ID {
			sendErr(c, "playlist_not_found", "")
			return
		}

		if pl.Name == config.AllPlaylistKey {
			sendErr(c, "ap_rename_unallowed", "")
			return
		}

		if pl.Name == newName {
			sendErr(c, "no_changes", "")
			return
		}

		pl.Name = newName
		_, dbErr = db.UpdatePlaylist(pl)

		if dbErr == nil {
			sendSuccess(c)
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}
	} else if dbErr.underlying != sql.ErrNoRows {
		sendErr(c, "playlist_not_found", "")
	} else {
		sendDBErrorAndPrint(c, dbErr)
	}
}

func R_updatepl(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newID := c.PostForm("id")
	newTracks := c.PostForm("tracks")

	plID, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("id: %v", newID), err)
		return
	}

	err = validate(nv(newTracks, 2))

	if err != nil {
		sendValidationError(c, fmt.Sprintf("tracks: %v", newTracks), err)
		return
	}

	if plID < 0 {
		pl, dbErr := db.GetLibraryPlaylist(u.ID)

		if pl != nil {
			pl.Tracks = newTracks

			_, dbErr := db.UpdatePlaylist(pl)

			if dbErr != nil {
				sendDBErrorAndPrint(c, dbErr)
				return
			}

			plID = pl.ID
		} else if dbErr.underlying == sql.ErrNoRows {
			pl = &DBPlaylist{
				ID:      0,
				Name:    config.AllPlaylistKey,
				ownerID: u.ID,
				Tracks:  newTracks,
			}

			res, dbErr := db.AddPlaylist(pl)

			if dbErr != nil {
				sendDBErrorAndPrint(c, dbErr)
				return
			}

			lastId, _ := res.LastInsertId()
			plID = int(lastId)
		} else {
			sendDBErrorAndPrint(c, dbErr)
			return
		}
	} else {
		pl, dbErr := db.GetPlaylist(plID)

		if dbErr != nil {
			if dbErr.underlying == sql.ErrNoRows {
				sendErr(c, "playlist_not_found", "")
			} else {
				sendDBErrorAndPrint(c, dbErr)
			}

			return
		}

		if pl.ownerID != u.ID {
			sendErr(c, "playlist_not_found", "")
			return
		}

		pl.Tracks = newTracks

		_, dbErr = db.UpdatePlaylist(pl)

		if dbErr != nil {
			sendDBErrorAndPrint(c, dbErr)
			return
		}
	}

	sendRes(c, plID)
}

func R_resetpassword(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	newID := c.PostForm("id")
	uID, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprint("id: ", newID), err)
		return
	}

	if uID == u.ID {
		sendErr(c, "dont_reset_yourself", "")
		return
	}

	newU, dbErr := db.GetUser(uID)

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "user_not_found", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}

		return
	}

	if newU.login == config.RootUser {
		sendErr(c, "cannot_modify_root_user", "")
		return
	}

	newPassword := genPassword()
	newU.password = md5String(newPassword)

	_, dbErr = db.UpdateUser(newU)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendRes(c, &gin.H{
		"newPassword": newPassword,
	})
}

func R_changepassword(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	oldPassword := c.PostForm("old")
	newPassword := c.PostForm("new")

	err := validateMany(
		nv(oldPassword, 3, 20),
		nv(newPassword, 3, 20),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("old: %v; new: %v", strings.Repeat("*", len(oldPassword)), strings.Repeat("*", len(newPassword))), err)
		return
	}

	if u.password != md5String(oldPassword) {
		sendErr(c, "old_password_incorrect", "")
		return
	}

	u.password = md5String(newPassword)

	_, dbErr := db.UpdateUser(u)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendSuccess(c)
}

func R_updateuser(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	newLang := c.PostForm("lang")
	newRemIP := c.PostForm("rem_ip")
	newAutoplay := c.PostForm("autoplay")

	err := validateMany(
		nv(newLang, 1, 10),
		nv(newRemIP, 4, 5),
		nv(newAutoplay, 4, 5),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("lang: %v; rem_ip: %v; autoplay: %v", newLang, newRemIP, newAutoplay), err)
		return
	}

	var remip, autoplay bool = false, false

	if newAutoplay == "true" {
		autoplay = true
	}

	if newRemIP == "true" {
		remip = true
	}

	if remip == u.RemIP && autoplay == u.Autoplay && newLang == u.Lang {
		sendErr(c, "no_changes", "")
		return
	}

	newUser := &DBUser{
		password:    u.password,
		sessionHash: u.sessionHash,
		ip:          u.ip,
		vkCookies:   u.vkCookies,
		ID:          u.ID,
		login:       u.login,
		Theme:       u.Theme,
		VkUser:      u.VkUser,
		IsAdmin:     u.IsAdmin,
		Lang:        newLang,
		RemIP:       remip,
		Autoplay:    autoplay,
		Nickanme:    u.Nickanme,
		Themes:      u.Themes,
	}

	_, dbErr := db.UpdateUser(newUser)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	u.Autoplay = autoplay
	u.RemIP = remip
	u.Lang = newLang

	sendSuccess(c)
}

func R_updatetheme(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newActiveTheme := c.PostForm("theme")

	err := validate(nv(newActiveTheme, 0, 50))

	if err != nil {
		sendValidationError(c, fmt.Sprintf("theme: %v", newActiveTheme), err)
		return
	}

	_, dbErr := db.SetUserTheme(u.ID, newActiveTheme)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	u.Theme = newActiveTheme

	sendSuccess(c)
}

func R_updatethemes(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newThemeList := c.PostFormArray("list[]")

	if len(newThemeList) >= 20 {
		sendValidationError(c, fmt.Sprintf("list: %v", newThemeList), errors.New("Themes list length must be in range between 0 and 20"))
		return
	}

	themeList := make(map[string]AudyTheme, 0)
	current := ""

	for _, v := range newThemeList {
		var theme AudyTheme
		err := json.Unmarshal([]byte(v), &theme)

		if err != nil {
			sendErr(c, "theme_parse", fmt.Sprintf("Unable to parse json: \"%v\" of incoming theme", v))
			return
		} else {
			err = validateMany(
				nv(theme.Name, 1, 20),
				nv(theme.Id, 1, 50),
			)

			if err != nil {
				sendValidationError(c, fmt.Sprintf("name: %v; id: %v", theme.Name, theme.Id), err)
				return
			}

			if !validateThemeKeys(theme) {
				sendErr(c, "theme_key_invalid", fmt.Sprintf("Given theme contains unallowed keys in color and/or vars section: %v", theme))
				return
			}
		}

		themeList[theme.Id] = theme

		if theme.Id == u.Theme {
			current = theme.Id
		}
	}

	themeJson, err := json.Marshal(themeList)

	if err != nil {
		sendErr(c, "themes_list_json_marshal", fmt.Sprintf("Unable to parse your theme data to json. resulted list: %v", themeList))
		return
	}

	themeJsonStr := string(themeJson)
	_, dbErr := db.SetUserThemes(u.ID, themeJsonStr, current)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	u.Themes = themeJsonStr
	u.Theme = current

	sendSuccess(c)
}

func R_removeuser(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	newID := c.PostForm("id")
	uID, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprint("id: ", newID), err)
		return
	}

	newU, dbErr := db.GetUser(uID)

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "user_not_found", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}

		return
	}

	if newU.login == config.RootUser {
		sendErr(c, "cannot_modify_root_user", "")
		return
	}

	_, dbErr = db.RemoveUser(uID)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	avatarFile := fmt.Sprintf("db/avatars/%v.jpg", uID)

	if _, err := os.Stat(avatarFile); os.IsExist(err) {
		os.Remove(avatarFile)
	}

	if _, ok := channels[u.ID]; ok {
		channels[u.ID].SendMessage(&gin.H{
			"type": "kick",
			"data": nil,
		})
	}

	sendSuccess(c)
}

func R_getplaylists(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	pls, err := db.GetPlaylists(u.ID)

	if err != nil {
		if err.underlying != sql.ErrNoRows {
			sendDBErrorAndPrint(c, err)
			return
		}

		pls = make([]*DBPlaylist, 0)
	}

	sendRes(c, pls)
}

func R_albumimage(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	hash := c.Param("hash")
	hash = strings.Replace(hash, "/", "", -1)
	hash = strings.Replace(hash, ".", "", -1)
	hash = strings.Replace(hash, "*", "", -1)

	dbPath := fmt.Sprint("db/music/", hash, "/image.jpg")

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		c.File("front/dist/img/default_album.png")
	} else {
		c.File(dbPath)
	}
}

func R_avatar(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	avatarFile := fmt.Sprintf("db/avatars/%v.jpg", u.ID)
	if _, err := os.Stat(avatarFile); os.IsNotExist(err) {
		c.File("front/dist/img/default_avatar.png")
	} else {
		c.File(avatarFile)
	}
}

/*
func R_vk_login(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	email := c.PostForm("email")
	pass := c.PostForm("pass")

	if len(email) == 0 || len(pass) == 0 {
		sendValidationError(c, fmt.Sprintf("email: %v; pass: %v", email, strings.Repeat("*", len(pass))))
		return
	}

	res, userID, err := vkApiLogin(email, pass)

	if err != nil {
		errMsg := err.Error()

		if strings.HasPrefix(errMsg, "error_") {
			sendErrAndPrint(c, errMsg, "")
		} else if strings.HasPrefix(errMsg, "vk2fa_needed_") {
			sendErr(c, errMsg, "")
		} else {
			sendErrAndPrint(c, "vk_unexpected", errMsg)
		}

		return
	}

	u.vkCookies = res
	u.VkUser = userID

	_, dbErr := db.UpdateUser(u)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendRes(c, &gin.H{
		"vk_user": userID,
	})
}

func R_vk_search(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	query := c.PostForm("query")

	if len(query) == 0 {
		sendValidationError(c, fmt.Sprint("query: ", query))
		return
	}

	res, err := vkApiGetTracks(u, query)

	if err != nil {
		errMsg := err.Error()

		if strings.HasPrefix(errMsg, "error_") {
			sendErr(c, errMsg, "")
		} else {
			sendErrAndPrint(c, "vk_unexpected", errMsg)
		}

		return
	}

	sendRes(c, &gin.H{
		"tracks": res,
	})
}

func R_vk_links(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	ids := c.PostFormArray("ids[]")

	if len(ids) == 0 {
		sendValidationError(c, fmt.Sprint("ids: ", ids))
		return
	}

	links, err := vkApiGetLinks(u, ids)

	if err != nil {
		errMsg := err.Error()

		if strings.HasPrefix(errMsg, "error_") {
			sendErrAndPrint(c, errMsg, "")
		} else {
			sendErrAndPrint(c, "vk_unexpected", errMsg)
		}

		return
	}

	sendRes(c, &gin.H{
		"links": links,
	})
}

func R_vk_enqd(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	tracksJson := c.PostForm("tracks")

	if len(tracksJson) == 0 {
		sendValidationError(c, fmt.Sprint("tracks: ", tracksJson))
		return
	}

	if _, ok := vkQueue[u.ID]; !ok {
		vkQueue[u.ID] = &VkQueue{
			inProgress: false,
			queue:      make([]*VkTrack, 0),
			u:          u,
			dequeue:    make(map[string]string, 0),
			listeners:  0,
		}
	}

	var tracks []*VkTrack
	err := json.NewDecoder(strings.NewReader(tracksJson)).Decode(&tracks)

	if err != nil {
		sendErr(c, "incorrect_json", err.Error())
		return
	}

	for _, t := range tracks {
		vkQueue[u.ID].queue = append(vkQueue[u.ID].queue, t)
	}

	sendSuccess(c)
}

func R_vk_deqd(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	if _, ok := vkQueue[u.ID]; !ok {
		sendErr(c, "no_queue", "")
		return
	}

	deqTracks := c.PostFormArray("tracks")

	for _, t := range deqTracks {
		vkQueue[u.ID].dequeue[t] = ""
	}

	sendSuccess(c)
}

func R_vk_queue(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	if _, ok := vkQueue[u.ID]; !ok || len(vkQueue[u.ID].queue) == 0 {
		sendErr(c, "queue_empty", "")
		return
	}

	vkQueue[u.ID].ch = make(chan interface{}, 100)
	vkQueue[u.ID].listeners++

	if !vkQueue[u.ID].inProgress {
		go vkQueueProcess(u)
	}

	c.Header("Connection", "keep-alive")
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Status(http.StatusPartialContent)

	c.Stream(func(w io.Writer) bool {
		if msg, ok := <-vkQueue[u.ID].ch; ok {
			c.SSEvent("message", msg)
			return true
		}

		return false
	})

	vkQueue[u.ID].listeners--
}
*/
func R_init(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	c.Header("Connection", "keep-alive")
	c.Header("Content-Type", "text/event-stream")

	if _, ok := channels[u.ID]; ok {
		c.SSEvent("message", &gin.H{
			"type": "error",
			"data": &gin.H{
				"key":   "already_connected",
				"error": "This user is already connected to channel",
			},
		})

		return
	}

	ch := make(chan interface{}, 10)
	acl := &AudyChanListener{
		Channel:      ch,
		User:         u,
		ChCtx:        c,
		Disconnected: false,
	}

	channels[u.ID] = acl

	pls, err := db.GetPlaylists(u.ID)

	if err != nil {
		if err.underlying != sql.ErrNoRows {
			sendDBErrorAndPrint(c, err)
			return
		}
	}

	/*queueCount := 0

	if _, ok := vkQueue[u.ID]; ok {
		queueCount = len(vkQueue[u.ID].queue)
	}*/

	go func() {
		ch <- &gin.H{
			"type": "init",
			"data": &gin.H{
				"lib":              libJSONCache,
				"playlists":        pls,
				"apk":              config.AllPlaylistKey,
				"u":                u,
				"custom_app_title": config.CustomAppTitle,
			},
		}

		select {
		case <-c.Request.Context().Done():
			if !acl.Disconnected {
				close(ch)
				acl.Disconnected = true
			}

			delete(channels, u.ID)

			if gin.Mode() == gin.DebugMode {
				fmt.Printf("User %v disconnected\n", u.login)
			}
		}
	}()

	acl.Disconnected = c.Stream(func(w io.Writer) bool {
		if msg, ok := <-ch; ok {
			c.SSEvent("message", msg)
			return true
		}

		return false
	})
}

func R_closech(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	if _, ok := channels[u.ID]; !ok {
		sendErr(c, "channel_not_found", fmt.Sprintf("No channel found for user %v", u.login))
		return
	}

	channels[u.ID].SendMessage(&gin.H{
		"type": "destroy",
		"data": nil,
	})

	if !channels[u.ID].Disconnected {
		channels[u.ID].ChCtx.Abort()
	}

	delete(channels, u.ID)
	sendSuccess(c)
}

func R_download(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	hash := c.Param("file")

	if len(hash) == 0 {
		sendValidationError(c, fmt.Sprint("file: ", hash), errors.New("Given file hash for download was empty"))
		return
	}

	filePath := fmt.Sprint("db/music/", hash, "/track")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	t, dbErr := db.GetTrack(hash)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	saveName := fmt.Sprint(t.Artist, " - ", t.Title, ".mp3")

	c.FileAttachment(filePath, saveName)
}

func R_changenickname(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newNickname := c.PostForm("newNickname")

	err := validate(nv(newNickname, 3, 20))

	if err != nil {
		sendValidationError(c, fmt.Sprint("newLogin: ", newNickname), err)
		return
	}

	_, dbErr := db.SetUserNickname(u.ID, newNickname)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	u.Nickanme = newNickname

	sendSuccess(c)
}

func R_changeavatar(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	newAvatar, err := c.FormFile("newAvatar")

	if err != nil {
		sendErr(c, "no_file", "Unable to read POST data file 'newAvatar'")
		return
	}

	r, err := newAvatar.Open()

	if err != nil {
		sendErr(c, "unable_to_open_file", "Unable to open image file")
		return
	}

	defer r.Close()
	image, err := imaging.Decode(r)

	if err != nil {
		sendErr(c, "unable_to_decode_image", "Unable to decode image file")
		return
	}

	size := image.Bounds().Size()

	if math.Abs(float64(size.X)-float64(size.Y)) > 2 {
		sendErr(c, "image_dimensions_not_equal", fmt.Sprintf("Image width[%v] and height[%v] was not pretty equal", size.X, size.Y))
		return
	}

	if size.X > 512 {
		image = imaging.Resize(image, 512, 512, imaging.Lanczos)
	}

	filePath := fmt.Sprintf("db/avatars/%v.jpg", u.ID)

	if _, err := os.Stat("db/avatars"); os.IsNotExist(err) {
		os.Mkdir("db/avatars", os.ModePerm)
	}

	err = imaging.Save(image, filePath, imaging.JPEGQuality(80))

	if err != nil {
		sendErr(c, "unable_to_encode_image", err.Error())
		return
	}

	u.HasAvatar = true
	sendSuccess(c)
}

func R_removeavatar(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.check(c) {
		return
	}

	fileName := fmt.Sprintf("db/avatars/%v.jpg", u.ID)
	if _, err := os.Stat(fileName); os.IsNotExist(err) {
		sendErr(c, "no_avatar_file", "")
		return
	}

	err := os.Remove(fileName)

	if err != nil {
		sendErr(c, "avatar_remove", err.Error())
		return
	}

	u.HasAvatar = false
	sendSuccess(c)
}

func R_adduser(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	newLogin := c.PostForm("login")
	newPassword := c.PostForm("password")
	newIsAdmin := c.PostForm("is_admin")

	err := validateMany(
		nv(newLogin, 3, 20),
		nv(newPassword, 3, 20),
		nv(newIsAdmin, 4, 5),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("login: %v; password: %v; is_admin: %v", newLogin, strings.Repeat("*", len(newPassword)), newIsAdmin), err)
		return
	}

	existingUser, dbErr := db.GetUserByLogin(newLogin)

	if dbErr != nil && dbErr.underlying != sql.ErrNoRows {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	if existingUser != nil {
		sendErr(c, "login_already_taken", "")
		return
	}

	isAdmin := false

	if newIsAdmin == "true" {
		isAdmin = true
	}

	newUser := &DBUser{
		login:    newLogin,
		password: md5String(newPassword),
		IsAdmin:  isAdmin,
	}

	res, dbErr := db.AddUser(newUser)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	lastId, _ := res.LastInsertId()
	sendRes(c, &gin.H{
		"id":       lastId,
		"nickname": newLogin,
		"is_admin": isAdmin,
	})
}

func R_getserverdata(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	users, dbErr := db.GetUsers()

	if dbErr != nil && dbErr.underlying != sql.ErrNoRows {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendRes(c, &gin.H{
		"users": users,
		"vars": &gin.H{
			"default_language": config.DefaultLang,
			"session_time":     config.SessionTime,
			"custom_app_title": config.CustomAppTitle,
		},
	})
}

func R_setserverdata(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkAdmin(c) {
		return
	}

	newDefaultLanguage := c.PostForm("default_language")
	newSessionTime := c.PostForm("session_time")
	newCustomAppTitle := c.PostForm("custom_app_title")

	err := validateMany(
		nv(newDefaultLanguage, 2, 2),
		nv(newSessionTime, 1, 20),
		nv(newCustomAppTitle, 1, 128),
	)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("default_language: %v; session_time: %v; custom_app_title: %v", newDefaultLanguage, newSessionTime, newCustomAppTitle), err)
		return
	}

	sessionTime, err := strconv.Atoi(newSessionTime)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("default_language: %v; session_time: %v; custom_app_title: %v", newDefaultLanguage, newSessionTime, newCustomAppTitle),
			errors.New(fmt.Sprintf("Unable to convert %v to integer value", newSessionTime)))
		return
	}

	config.DefaultLang = newDefaultLanguage
	config.CustomAppTitle = newCustomAppTitle
	config.SessionTime = sessionTime
	err = saveConfig()

	if err != nil {
		sendErr(c, "saving_config", err.Error())
		return
	}

	sendSuccess(c)
}

func R_setadmin(c *gin.Context) {
	u := auth.GetUser(c)

	if !u.checkRoot(c) {
		return
	}

	newID := c.PostForm("id")
	id, err := strconv.Atoi(newID)

	if err != nil {
		sendValidationError(c, fmt.Sprintf("id: %v", newID), err)
		return
	}

	newState := c.PostForm("state")
	err = validate(nv(newState, 4, 5))

	if err != nil {
		sendValidationError(c, fmt.Sprintf("state: %v", newState), err)
		return
	}

	state := true

	if newState != "true" {
		state = false
	}

	user, dbErr := db.GetUser(id)

	if dbErr != nil {
		if dbErr.underlying == sql.ErrNoRows {
			sendErr(c, "user_not_found", "")
		} else {
			sendDBErrorAndPrint(c, dbErr)
		}

		return
	}

	if user.login == config.RootUser {
		sendErr(c, "cannot_modify_root_user", "")
		return
	}

	_, dbErr = db.SetUserAdmin(id, state)

	if dbErr != nil {
		sendDBErrorAndPrint(c, dbErr)
		return
	}

	sendSuccess(c)
}
