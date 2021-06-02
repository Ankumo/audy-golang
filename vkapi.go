//source: https://github.com/python273/vk_api
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type VkTrack struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Duration int    `json:"duration"`
	Link     string `json:"link"`
}

type VkQueue struct {
	u          *DBUser
	queue      []*VkTrack
	ch         chan interface{}
	listeners  int
	dequeue    map[string]string
	inProgress bool
}

type ProgressReader struct {
	u           *DBUser
	downloaded  int
	total       int
	lastPrecent int
	track       string
}

var vkQueue map[int]*VkQueue
var DequeueError error = errors.New("track dequeued")
var userAgent string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36"

func getRegexpMatch(regex string, bytes []byte) (string, error) {
	re, _ := regexp.Compile(regex)
	match := re.FindSubmatch(bytes)

	if len(match) < 2 {
		return "", fmt.Errorf("Unable to find match %v in string %v\n", regex, string(bytes))
	}

	return string(match[1]), nil
}

func vkApiLogin(email, pass string) (string, int, error) {
	req, _ := http.NewRequest("GET", "https://vk.com", strings.NewReader(""))
	req.Header.Set("user-agent", userAgent)

	dc := &http.Client{}

	resp, err := dc.Do(req)

	if err != nil {
		return "", 0, err
	}

	defer resp.Body.Close()

	bytes, err := ioutil.ReadAll(resp.Body)

	if err != nil {
		return "", 0, err
	}

	lgh, err := getRegexpMatch("name=\"lg_h\" value=\"([a-z0-9]+)", bytes)

	if err != nil {
		return "", 0, err
	}

	formData := url.Values{
		"act":     {"login"},
		"email":   {email},
		"pass":    {pass},
		"role":    {"al_frame"},
		"lg_h":    {lgh},
		"_origin": {"https://vk.com"},
		"utf8":    {"1"},
	}

	req, _ = http.NewRequest("POST", "https://login.vk.com/?act=login", strings.NewReader(formData.Encode()))

	req.Header.Set("Origin", "https://vk.com")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("user-agent", userAgent)

	defaultVkCookies := resp.Cookies()

	for _, c := range defaultVkCookies {
		req.AddCookie(c)
	}

	resp, err = dc.Do(req)

	if err != nil {
		return "", 0, err
	}

	bytes, err = ioutil.ReadAll(resp.Body)

	if err != nil {
		return "", 0, err
	}

	loginResponse := string(bytes)

	if strings.Contains(loginResponse, "onLoginFailed(4") {
		return "", 0, fmt.Errorf("error_creds_incorrect")
	}

	if strings.Contains(loginResponse, "act=blocked") {
		return "", 0, fmt.Errorf("error_account_blocked")
	}

	if strings.Contains(loginResponse, "onLoginCaptcha(") || strings.Contains(loginResponse, "onLoginReCaptcha(") {
		return "", 0, fmt.Errorf("error_captcha_needed")
	}

	if strings.Contains(loginResponse, "act=authcheck") {
		authHash, err := getRegexpMatch("\\{.*?act: 'a_authcheck_code'.+?hash: '([a-z_0-9]+)'.*?\\}", bytes)

		if err != nil {
			return "", 0, err
		}

		return "", 0, fmt.Errorf("vk2fa_needed_%v", authHash)
	}

	remixsid := ""

	for _, v := range resp.Cookies() {
		if v.Name == "remixsid" {
			remixsid = v.Value
			break
		}
	}

	if len(remixsid) == 0 {
		return "", 0, fmt.Errorf("error_no_remixsid")
	}

	req, _ = http.NewRequest("GET", "https://vk.com/feed2.php", strings.NewReader(""))

	req.Header.Set("Origin", "https://vk.com")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("user-agent", userAgent)

	for _, c := range defaultVkCookies {
		req.AddCookie(c)
	}

	req.AddCookie(vkCreateCookieHTTP("remixsid", remixsid))

	resp, err = dc.Do(req)

	if err != nil {
		return "", 0, err
	}

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)

	if err != nil {
		return "", 0, err
	}

	if _, ok := result["user"]; !ok {
		return "", 0, fmt.Errorf("error_no_response_payload")
	}

	result, ok := result["user"].(map[string]interface{})

	if !ok {
		return "", 0, fmt.Errorf("error_incorrect_payload")
	}

	if _, ok := result["id"]; !ok {
		return "", 0, fmt.Errorf("error_incorrect_payload")
	}

	userID := int(result["id"].(float64))

	vkUserJson := make(map[string]string, 0)

	vkUserJson["user_id"] = fmt.Sprint(userID)
	vkUserJson["remixsid"] = remixsid

	bytes, _ = json.Marshal(vkUserJson)

	return string(bytes), userID, nil
}

func vkApi2FA(code, authHash string, cookies []*http.Cookie) error {
	formData := &url.Values{
		"act":      {"a_authcheck_code"},
		"al":       {"1"},
		"code":     {code},
		"remember": {"1"},
		"hash":     {authHash},
	}

	req, _ := http.NewRequest("POST", "https://vk.com/al_login.php", strings.NewReader(formData.Encode()))
	dc := &http.Client{}

	req.Header.Add("user-agent", userAgent)

	for _, c := range cookies {
		req.AddCookie(c)
	}

	resp, err := dc.Do(req)

	if err != nil {
		return err
	}

	defer resp.Body.Close()

	bytes, err := ioutil.ReadAll(resp.Body)

	if err != nil {
		return err
	}

	faResponse := string(bytes)
	faResponse = strings.Replace(faResponse, "<!--", "", -1)
	faResponse = strings.Replace(faResponse, "-->", "", -1)

	var result map[string]interface{}

	err = json.NewDecoder(strings.NewReader(faResponse)).Decode(&result)

	if err != nil {
		fmt.Println("vk2fa response:")
		fmt.Println(faResponse)
		return err
	}

	payload, ok := result["payload"]

	if !ok {
		fmt.Println("vk2fa response:")
		fmt.Println(faResponse)
		return fmt.Errorf("error_no_response_payload")
	}

	payloads := payload.([]interface{})

	if len(payloads) == 0 {
		fmt.Println("vk2fa response:")
		fmt.Println(faResponse)
		return fmt.Errorf("error_incorrect_payload")
	}

	status := fmt.Sprint(payloads[0])

	if status == "4" {
		return nil
	}

	if status == "0" || status == "8" {
		return fmt.Errorf("error_vk2fa_code_incorrect")
	}

	if status == "2" {
		return fmt.Errorf("error_captcha_required")
	}

	fmt.Println("vk2fa response:")
	fmt.Println(faResponse)
	return fmt.Errorf("error_vk2fa_unexpected")
}

func vkApiGetTracks(u *DBUser, query string) ([]*VkTrack, error) {
	vkData, err := checkVkSession(u.vkCookies)

	if err != nil {
		return nil, err
	}

	formData := url.Values{
		"q":        {query},
		"act":      {"section"},
		"section":  {"search"},
		"al":       {"1"},
		"owner_id": {fmt.Sprint(u.VkUser)},
	}

	req, err := http.NewRequest("POST", "https://vk.com/al_audio.php", strings.NewReader(formData.Encode()))

	if err != nil {
		return nil, err
	}

	req.Header.Set("Origin", "https://vk.com")
	req.Header.Set("x-requested-with", "XMLHttpRequest")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	req.AddCookie(vkCreateCookieHTTP("remixsid", vkData["remixsid"]))

	dc := &http.Client{}
	resp, err := dc.Do(req)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var result map[string]interface{}

	err = json.NewDecoder(resp.Body).Decode(&result)

	if err != nil {
		return nil, err
	}

	_, ok := result["payload"]

	if !ok {
		return nil, fmt.Errorf("error_no_response_payload")
	}

	payloads, ok := result["payload"].([]interface{})

	if !ok || len(payloads) < 2 {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	resultCode := payloads[0].(string)

	if resultCode != "0" {
		return nil, fmt.Errorf("error_vk_login_required")
	}

	payloads, ok = payloads[1].([]interface{})

	if !ok || len(payloads) < 2 {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	result, ok = payloads[1].(map[string]interface{})

	if !ok {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	_, ok = result["playlist"]

	if !ok {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	result, ok = result["playlist"].(map[string]interface{})

	if !ok {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	_, ok = result["list"]

	if !ok {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	list, ok := result["list"].([]interface{})

	if !ok {
		return nil, fmt.Errorf("error_incorrect_payload")
	}

	var tracks []*VkTrack
	for _, v := range list {
		t, ok := v.([]interface{})

		if !ok || len(t) < 15 {
			continue
		}

		parts := strings.Split(fmt.Sprint(t[13]), "/")
		hashes := make([]string, 0)

		for _, p := range parts {
			if len(p) > 0 {
				hashes = append(hashes, p)
			}
		}

		if len(hashes) != 3 {
			continue
		}

		id := fmt.Sprintf("%v_%v_%v_%v", int(t[1].(float64)), int(t[0].(float64)), hashes[1], hashes[2])

		tracks = append(tracks, &VkTrack{
			ID:       id,
			Artist:   fmt.Sprint(t[4]),
			Title:    fmt.Sprint(t[3]),
			Duration: int(t[5].(float64)),
		})
	}

	return tracks, nil
}

func vkApiGetLinks(u *DBUser, ids []string) (map[string]string, error) {
	vkData, err := checkVkSession(u.vkCookies)

	if err != nil {
		return nil, err
	}

	formData := url.Values{
		"al":  {"1"},
		"ids": {strings.Join(ids, ",")},
	}

	req, err := http.NewRequest("POST", "https://vk.com/al_audio.php?act=reload_audio", strings.NewReader(formData.Encode()))

	if err != nil {
		return nil, err
	}

	req.Header.Set("Origin", "https://vk.com")
	req.Header.Set("x-requested-with", "XMLHttpRequest")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	req.AddCookie(vkCreateCookieHTTP("remixsid", vkData["remixsid"]))

	dc := &http.Client{}
	resp, err := dc.Do(req)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var result map[string]interface{}

	err = json.NewDecoder(resp.Body).Decode(&result)

	if err != nil {
		return nil, err
	}

	fmt.Println(result)

	_, ok := result["payload"]

	if !ok {
		return nil, fmt.Errorf("error_no_response_payload")
	}

	payloads, ok := result["payload"].([]interface{})

	if !ok || len(payloads) < 2 {
		fmt.Println(result)
		return nil, fmt.Errorf("error_incorrect_payload1")
	}

	payloads, ok = payloads[1].([]interface{})

	if !ok || len(payloads) == 0 {
		fmt.Println(result)
		return nil, fmt.Errorf("error_incorrect_payload2")
	}

	payloads, ok = payloads[0].([]interface{})

	if !ok || len(payloads) == 0 {
		fmt.Println(result)
		return nil, fmt.Errorf("error_incorrect_payload3")
	}

	links := make(map[string]string, 0)
	for _, v := range payloads {
		t, ok := v.([]interface{})

		if !ok || len(t) < 15 {
			continue
		}

		parts := strings.Split(fmt.Sprint(t[13]), "/")
		hashes := make([]string, 0)

		for _, p := range parts {
			if len(p) > 0 {
				hashes = append(hashes, p)
			}
		}

		if len(hashes) != 3 {
			continue
		}

		id := fmt.Sprintf("%v_%v_%v_%v", int(t[1].(float64)), int(t[0].(float64)), hashes[1], hashes[2])

		links[id] = fmt.Sprint(t[2])
	}

	return links, nil
}

func checkVkSession(data string) (map[string]string, error) {
	vkData := make(map[string]string, 0)
	err := json.NewDecoder(strings.NewReader(data)).Decode(&vkData)

	if err != nil {
		return nil, err
	}

	_, ok := vkData["remixsid"]

	if !ok {
		return nil, fmt.Errorf("error_no_vk_login")
	}

	_, ok = vkData["user_id"]

	if !ok {
		return nil, fmt.Errorf("error_no_vk_login")
	}

	return vkData, nil
}

func vkCreateCookie(name, val string, httpOnly bool) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    val,
		Domain:   ".vk.com",
		Path:     "/",
		HttpOnly: httpOnly,
		Expires:  time.Now().Add(365 * 24 * time.Hour),
		Secure:   true,
	}
}

func vkCreateCookieHTTP(name, val string) *http.Cookie {
	return vkCreateCookie(name, val, true)
}

func vkQueueProcess(u *DBUser) {
	if _, ok := vkQueue[u.ID]; !ok || len(vkQueue[u.ID].queue) == 0 {
		return
	}

	ch := vkQueue[u.ID].ch
	defer close(ch)

	if _, err := os.Stat("upload/vk"); os.IsNotExist(err) {
		os.Mkdir("upload/vk", os.ModePerm)
	}

	vkQueue[u.ID].inProgress = true

	for {
		time.Sleep(1 * time.Second)

		track := vkQueue[u.ID].queue[0]
		vkQueue[u.ID].queue = vkQueue[u.ID].queue[1:]

		resp, err := http.Get(track.Link)
		fileSize, _ := strconv.Atoi(resp.Header.Get("content-length"))

		if err == nil {
			fileName := fmt.Sprint("upload/vk/", track.ID, ".mp3")
			f, err := os.Create(fileName)

			if err == nil {
				_, err = io.Copy(f, io.TeeReader(resp.Body, &ProgressReader{
					total:      fileSize,
					u:          u,
					downloaded: 0,
					track:      track.ID,
				}))

				if err != nil {
					ch <- &gin.H{
						"type":    "progress",
						"precent": "done",
						"id":      track.ID,
					}

					dbt, procErr := processVkTrack(f, fileName, track)

					if procErr != nil {
						status := ""
						key := ""
						if procErr.underlyingDB != nil {
							procErr.underlyingDB.Print()
							status = procErr.underlyingDB.Error()
						} else if procErr.underlying != nil {
							status = fmt.Sprintf("An error occurred while processing track %v! Info: %v\n%v\n", fileName, procErr.key, procErr.underlying.Error())
							fmt.Print(status)
						} else {
							key = fmt.Sprint("error_", procErr.key)
						}

						vkqpError(ch, track.ID, key, status)
					} else {
						ch <- &gin.H{
							"type": "processed",
							"data": dbt,
							"id":   track.ID,
						}
					}
				} else {
					f.Close()
					vkqpError(ch, track.ID, "dequeued", "")
				}
			} else {
				f.Close()
				vkqpError(ch, track.ID, "error_vk_file_create", err.Error())
			}
		} else if vkQueue[u.ID].listeners > 0 {
			vkqpError(ch, track.ID, "error_vk_file_download", err.Error())
		}

		resp.Body.Close()

		if len(vkQueue[u.ID].queue) == 0 {
			break
		}
	}

	if vkQueue[u.ID].listeners > 0 {
		ch <- "done"
	}

	vkQueue[u.ID].inProgress = false
}

func (pr *ProgressReader) Write(p []byte) (n int, err error) {
	n = len(p)
	pr.downloaded += n
	precent := int(math.Trunc(float64(pr.downloaded) / float64(pr.total) * 100.0))

	if vkQueue[pr.u.ID].listeners > 0 && pr.lastPrecent-precent != 0 {
		vkQueue[pr.u.ID].ch <- &gin.H{
			"type":    "progress",
			"id":      pr.track,
			"precent": precent,
		}
	}

	pr.lastPrecent = precent

	if _, ok := vkQueue[pr.u.ID].dequeue[pr.track]; ok {
		delete(vkQueue[pr.u.ID].dequeue, pr.track)
		err = DequeueError
	}

	return
}

func vkqpError(ch chan interface{}, id, key, err string) {
	ch <- &gin.H{
		"type":  "error",
		"id":    id,
		"key":   key,
		"error": err,
	}
}
