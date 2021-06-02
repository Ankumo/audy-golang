package main

import (
	"fmt"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

type AudyConfig struct {
	SessionTime    int    `json:"session_time"`
	RootUser       string `json:"root_user"`
	AllPlaylistKey string `json:"all_playlist_key"`
	DefaultLang    string `json:"default_language"`
	CustomAppTitle string `json:"custom_app_title"`
}

const Version float32 = 0.1
const Port uint16 = 80

var db *DBWorker = CreateDBWorker()

var lib map[string]*DBTrack
var libJSONCache string

var auth *AudyAuth = &AudyAuth{}

var config *AudyConfig = &AudyConfig{
	SessionTime:    140,
	RootUser:       "root",
	AllPlaylistKey: "__PL_ALL_AUDIO__",
	DefaultLang:    "en",
}

func main() {
	fmt.Printf("Welcome to Audy v%v server\n", Version)
	r := gin.Default()
	gin.SetMode(gin.DebugMode)

	loadConfig()
	loadLib()
	removeUnusedMusic()

	fmt.Printf("md5 of 12345: %v\n", md5String("12345"))

	route(r)
	fmt.Printf("error! server crashed: %v\n", r.Run(fmt.Sprint(":", Port)).Error())
}

func route(r *gin.Engine) {
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.File("./front/src/dist/favicon.ico")
	})

	r.Use(static.Serve("/css", static.LocalFile("./front/src/dist/css", false)))
	r.Use(static.Serve("/img", static.LocalFile("./front/src/dist/img", false)))
	r.Use(static.Serve("/js", static.LocalFile("./front/src/dist/js", false)))
	r.Use(static.Serve("/fonts", static.LocalFile("./front/src/dist/fonts", false)))
	r.Use(auth.Middleware())

	if gin.Mode() == gin.DebugMode {
		r.Use(func(c *gin.Context) {
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Origin", c.Request.Header.Get("Origin"))
		})
	}

	r.GET("/music/:file", R_music)
	r.GET("/download/:file", R_download)

	api := r.Group("/api")
	{
		api.GET("/albumimage/:hash", R_albumimage)
		api.GET("/avatar", R_avatar)

		api.POST("/upload", R_upload)

		api.POST("/login", R_login)
		api.POST("/logout", R_logout)
		api.POST("/closech", R_closech)

		api.POST("/updatetrack", R_updatetrack)
		api.POST("/removetracks", R_removetracks)
		api.POST("/setlyrics", R_setlyrics)

		api.POST("/addpl", R_addpl)
		api.POST("/removepl", R_removepl)
		api.POST("/renamepl", R_renamepl)
		api.POST("/updatepl", R_updatepl)
		api.POST("/getplaylists", R_getplaylists)
		api.POST("/ftp_upload", R_ftpupload)

		api.POST("/updateuser", R_updateuser)
		api.POST("/removeuser", R_removeuser)
		api.POST("/changepassword", R_changepassword)
		api.POST("/resetpassword", R_resetpassword)
		api.POST("/updatetheme", R_updatetheme)
		api.POST("/updatethemes", R_updatethemes)
		api.POST("/changenickname", R_changenickname)
		api.POST("/changeavatar", R_changeavatar)
		api.POST("/removeavatar", R_removeavatar)
		api.POST("/adduser", R_adduser)
		api.POST("/setadmin", R_setadmin)

		api.POST("/getserverdata", R_getserverdata)
		api.POST("/setserverdata", R_setserverdata)

		api.GET("/init", R_init)
		/*
			vkapi := api.Group("/vk")
			{
				vkapi.POST("/search", R_vk_search)
				vkapi.POST("/login", R_vk_login)
				vkapi.POST("/links", R_vk_links)
				vkapi.POST("/enqd", R_vk_enqd)
				vkapi.POST("/deqd", R_vk_deqd)

				vkapi.GET("/queue", R_vk_queue)
			}*/
	}

	r.NoRoute(func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store")

		u := auth.GetUser(c)

		file := "./front/dist/index.html"

		if u == nil {
			file = "./front/dist/login.html"
		}

		c.File(file)
	})
}
