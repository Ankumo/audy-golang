package main

import (
	"fmt"
)

type DBUser struct {
	ID          int `json:"id"`
	login       string
	Nickanme    string `json:"nickname"`
	password    string
	sessionHash string
	ip          string
	Lang        string `json:"lang"`
	Theme       string `json:"theme"`
	Themes      string `json:"themes"`
	vkCookies   string
	VkUser      int  `json:"vk_user_id"`
	RemIP       bool `json:"rem_ip"`
	Autoplay    bool `json:"autoplay"`
	IsAdmin     bool `json:"is_admin"`
	HasAvatar   bool `json:"has_avatar"`
	IsRoot      bool `json:"is_root"`
}

type DBTrack struct {
	Md5       string  `json:"md5"`
	Artist    string  `json:"artist"`
	Title     string  `json:"title"`
	HasImage  bool    `json:"has_image"`
	Lyrics    string  `json:"lyrics"`
	Timestamp int     `json:"timestamp"`
	Duration  float32 `json:"duration"`
}

type DBPlaylist struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	ownerID int
	Tracks  string `json:"tracks"`
}

func (p *DBPlaylist) String() string {
	return fmt.Sprintf("{ id: %v; name: %v; owner_id: %v; tracks: %v }", p.ID, p.Name, p.ownerID, fmt.Sprintf("text(%v)", len(p.Tracks)))
}

func (s *DBTrack) String() string {
	return fmt.Sprintf("{ md5: %v; artist: %v; title: %v; has_image: %t; lyrics: %v; timestamp: %v; duration: %v }",
		s.Md5, s.Artist, s.Title, s.HasImage, fmt.Sprintf("text(%v)", len(s.Lyrics)), s.Timestamp, s.Duration)
}

func (u *DBUser) String() string {
	return fmt.Sprintf("{ id: %v; login: %v; nickname: %v; password: %v; session_hash: %v; ip: %v; lang: %v; theme: %v; vkCookies: %v; vkUser: %v; rem_ip: %t; autoplay: %t; is_admin: %t, themes: %v }",
		u.ID, u.login, u.Nickanme, u.password, u.sessionHash, u.ip, u.Lang, u.Theme, u.vkCookies, u.VkUser, u.RemIP, u.Autoplay, u.IsAdmin, u.Themes)
}
