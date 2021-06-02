package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type AudyAuth struct {
	SesCache map[string]*DBUser
}

const UserKey string = "__user_session__"

func (aa *AudyAuth) Middleware() gin.HandlerFunc {
	aa.SesCache = make(map[string]*DBUser, 0)

	return func(c *gin.Context) {
		cookie, err := c.Cookie("session_hash")

		if err == http.ErrNoCookie {
			c.Set(UserKey, nil)
			return
		}

		if _, ok := aa.SesCache[cookie]; ok {
			c.Set(UserKey, aa.SesCache[cookie])
		} else {
			u, dberr := db.GetUserByHash(cookie)

			if u != nil {
				u.HasAvatar = true
				u.IsRoot = config.RootUser == u.login

				avatarFilePath := fmt.Sprintf("db/avatars/%v.jpg", u.ID)
				if _, err = os.Stat(avatarFilePath); os.IsNotExist(err) {
					u.HasAvatar = false
				}
			}

			if dberr != nil {
				if dberr.underlying != sql.ErrNoRows {
					dberr.Print()
				}
			} else {
				aa.SesCache[u.sessionHash] = u
			}

			c.Set(UserKey, u)
		}

		c.Next()
	}
}

func (aa *AudyAuth) GetUser(c *gin.Context) *DBUser {
	v, ok := c.Get(UserKey)

	if !ok || v == nil {
		return nil
	}

	return v.(*DBUser)
}
