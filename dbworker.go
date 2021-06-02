package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type DBWorker struct {
	conn *sql.DB
}

type DBWorkerError struct {
	underlying error
	query      string
	desc       string
}

const dbPath string = "db/storage.db"

func (w *DBWorker) init() {
	_, err := os.Stat(dbPath)

	if os.IsNotExist(err) {
		os.Create(dbPath)
	}

	w.conn, err = sql.Open("sqlite3", dbPath)

	if err != nil {
		log.Fatalf("error while trying to set DB connection to file %v: %v\n", dbPath, err.Error())
		return
	}

	_, err = w.conn.Exec(`CREATE TABLE IF NOT EXISTS users (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							login TEXT NOT NULL DEFAULT '',
							nickname TEXT NOT NULL DEFAULT '',
							password TEXT NOT NULL DEFAULT '',
							session_hash TEXT NOT NULL DEFAULT '',
							ip TEXT NOT NULL DEFAULT '',
							lang TEXT NOT NULL DEFAULT '',
							theme TEXT NOT NULL DEFAULT '',
							themes TEXT NOT NULL DEFAULT '{}',
							vk_cookies TEXT NOT NULL DEFAULT '[]',
							vk_user INTEGER NOT NULL DEFAULT 0,
							rem_ip INTEGER NOT NULL DEFAULT 0,
							autoplay INTEGER NOT NULL DEFAULT 0,
							is_admin INTEGER NOT NULL DEFAULT 0)`)

	if err != nil {
		log.Fatalf("error while trying to create users table: %v\n", err.Error())
		return
	}

	_, err = w.conn.Exec(`CREATE TABLE IF NOT EXISTS music (
							md5 TEXT NOT NULL UNIQUE PRIMARY KEY,
							artist TEXT NOT NULL DEFAULT '',
							title TEXT NOT NULL DEFAULT '',
							has_image INTEGER NOT NULL DEFAULT 0,
							lyrics TEXT NOT NULL DEFAULT '',
							timestamp INT NOT NULL DEFAULT (strftime('%s', 'now')),
							duration REAL NOT NULL DEFAULT 0.0)`)
	if err != nil {
		log.Fatalf("error while trying to create music table: %v\n", err.Error())
		return
	}

	_, err = w.conn.Exec(`CREATE TABLE IF NOT EXISTS playlists (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							name TEXT NOT NULL DEFAULT '',
							owner_id INTEGER NOT NULL,
							tracks TEXT NOT NULL DEFAULT '[]')`)
	if err != nil {
		log.Fatalf("error while trying to create playlists table: %v\n", err.Error())
		return
	}

	fmt.Printf("Database loaded successfully from %v\n", dbPath)
}

func (err *DBWorkerError) Error() string {
	if err.underlying != nil {
		return fmt.Sprintf("DBWorker error! Description: \"%v\"\n Query: \"%v\"\n Error message: %v\n", err.desc, err.query, err.underlying.Error())
	}

	return fmt.Sprintf("Unexpected error happened with description \"%v\" \n and query: \"%v\"\n Error: %v\n", err.desc, err.query, err.Error())
}

func (err *DBWorkerError) Print() {
	fmt.Println(err.Error())
}

func CreateDBWorker() *DBWorker {
	worker := &DBWorker{}
	worker.init()

	return worker
}

func (w *DBWorker) Exec(query, errDesc string, args ...interface{}) (sql.Result, *DBWorkerError) {
	res, err := w.conn.Exec(query, args...)

	if err != nil {
		return res, &DBWorkerError{err, query, errDesc}
	}

	return res, nil
}

func (w *DBWorker) AddUser(u *DBUser) (sql.Result, *DBWorkerError) {
	query := `
		INSERT INTO users (login, nickname, password, lang, is_admin)
		VALUES (?,?,?,?,?)
	`

	return w.Exec(query, fmt.Sprint("adding user ", u),
		u.login, u.login, u.password, config.DefaultLang, u.IsAdmin)
}

func (w *DBWorker) RemoveUser(id int) (sql.Result, *DBWorkerError) {
	query := `
		DELETE FROM users
		WHERE id = ?
	`

	res, err := w.Exec(query, fmt.Sprint("removing user ", id), id)

	if err != nil {
		return res, err
	}

	query = `
		DELETE FROM playlists
		WHERE owner_id = ?
	`

	return w.Exec(query, fmt.Sprintf("removing user %v playlists", id), id)
}

func (w *DBWorker) UpdateUser(u *DBUser) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
		SET login = ?,
			nickname = ?,
			password = ?,
			session_hash = ?,
			ip = ?,
			lang = ?,
			theme = ?,
			themes = ?,
			vk_cookies = ?,
			vk_user = ?,
			rem_ip = ?,
			autoplay = ?,
			is_admin = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprint("update user ", u),
		u.login, u.Nickanme, u.password, u.sessionHash, u.ip, u.Lang, u.Theme, u.Themes, u.vkCookies, u.VkUser, u.RemIP, u.Autoplay, u.IsAdmin, u.ID)
}

func (w *DBWorker) UpdateUserHash(id int, hash string) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
		SET session_hash = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprintf("update user %v hash", id), hash, id)
}

func (w *DBWorker) AddTrack(t *DBTrack) (sql.Result, *DBWorkerError) {
	query := `
		INSERT INTO music (md5, artist, title, has_image, lyrics, timestamp, duration)
		VALUES(?1,?2,?3,?4,?5,?6,?7) 
		ON CONFLICT(md5) DO UPDATE SET
		artist = ?2,
		title = ?3,
		has_image = ?4,
		lyrics = ?5,
		timestamp = ?6,
		duration = ?7
	`

	res, err := w.conn.Exec(query, t.Md5, t.Artist, t.Title, t.HasImage, t.Lyrics, t.Timestamp, t.Duration)

	if err != nil {
		return res, &DBWorkerError{err, query, fmt.Sprint("adding track ", t)}
	}

	return res, nil
}

func (w *DBWorker) RemoveTrack(hash string) (sql.Result, *DBWorkerError) {
	query := `
		DELETE FROM music
		WHERE md5 = ?
	`

	return w.Exec(query, fmt.Sprint("removing track ", hash), hash)
}

func (w *DBWorker) RemoveTracks(hashes []interface{}) (sql.Result, *DBWorkerError) {
	query := fmt.Sprintf(`
		DELETE FROM music
		WHERE md5 IN (%v?)
	`, strings.Repeat("?,", len(hashes)-1))

	return w.Exec(query, fmt.Sprintf("removing tracks: %v", hashes), hashes...)
}

func (w *DBWorker) ClearLib() (sql.Result, *DBWorkerError) {
	query := `
		DELETE FROM music
	`

	return w.Exec(query, "clearing library")
}

func (w *DBWorker) AddPlaylist(p *DBPlaylist) (sql.Result, *DBWorkerError) {
	query := `
		INSERT INTO playlists (name, owner_id, tracks)
		VALUES(?,?,?)
	`

	return w.Exec(query, fmt.Sprint("adding playlist ", p), p.Name, p.ownerID, p.Tracks)
}

func (w *DBWorker) UpdatePlaylist(p *DBPlaylist) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE playlists
		SET name = ?,
			tracks = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprint("updating playlist ", p), p.Name, p.Tracks, p.ID)
}

func (w *DBWorker) RemovePlaylist(id int) (sql.Result, *DBWorkerError) {
	query := `
		DELETE FROM playlists
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprint("removing playlist ", id), id)
}

func (w *DBWorker) SetUserNickname(id int, nickname string) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
			SET nickname = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprintf("updating user [%v] nickname to: %v", id, nickname), nickname, id)
}

func (w *DBWorker) SetUserTheme(id int, theme string) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
			SET theme = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprintf("updating user [%v] theme to: \"%v\"", id, theme), theme, id)
}

func (w *DBWorker) SetUserThemes(id int, themes, theme string) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
			SET themes = ?,
				theme = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprintf("updating user [%v] themes list", id), themes, theme, id)
}

func (w *DBWorker) SetUserAdmin(id int, state bool) (sql.Result, *DBWorkerError) {
	query := `
		UPDATE users
			SET is_admin = ?
		WHERE id = ?
	`

	return w.Exec(query, fmt.Sprintf("updating user [%v] is_admin flag to: %v", id, state), state, id)
}

func (w *DBWorker) GetUserByCreds(login, password string) (*DBUser, *DBWorkerError) {
	query := `
		SELECT * FROM users
		WHERE login = ?
		AND password = ?
	`

	u := &DBUser{}
	err := w.conn.QueryRow(query, login, password).
		Scan(&u.ID, &u.login, &u.Nickanme, &u.password, &u.sessionHash, &u.ip, &u.Lang, &u.Theme, &u.Themes, &u.vkCookies, &u.VkUser, &u.RemIP, &u.Autoplay, &u.IsAdmin)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting user ", login)}
	}

	return u, nil
}

func (w *DBWorker) GetUser(id int) (*DBUser, *DBWorkerError) {
	query := `
		SELECT * FROM users
		WHERE id = ?
	`

	u := &DBUser{}
	err := w.conn.QueryRow(query, id).
		Scan(&u.ID, &u.login, &u.Nickanme, &u.password, &u.sessionHash, &u.ip, &u.Lang, &u.Theme, &u.Themes, &u.vkCookies, &u.VkUser, &u.RemIP, &u.Autoplay, &u.IsAdmin)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting user ", id)}
	}

	return u, nil
}

func (w *DBWorker) GetUserByHash(hash string) (*DBUser, *DBWorkerError) {
	query := `
		SELECT * FROM users
		WHERE session_hash = ?
	`

	u := &DBUser{}
	err := w.conn.QueryRow(query, hash).
		Scan(&u.ID, &u.login, &u.Nickanme, &u.password, &u.sessionHash, &u.ip, &u.Lang, &u.Theme, &u.Themes, &u.vkCookies, &u.VkUser, &u.RemIP, &u.Autoplay, &u.IsAdmin)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting user by hash ", hash)}
	}

	return u, nil
}

func (w *DBWorker) GetUsers() ([]*DBUser, *DBWorkerError) {
	query := `
		SELECT id, nickname, is_admin FROM users
	`

	result := []*DBUser{}

	rows, err := w.conn.Query(query)

	if err != nil {
		return result, &DBWorkerError{err, query, fmt.Sprint("getting users")}
	}

	for rows.Next() {
		u := &DBUser{}
		err = rows.
			Scan(&u.ID, &u.Nickanme, &u.IsAdmin)
			//Scan(&u.ID, &u.login, &u.Nickanme, &u.password, &u.sessionHash, &u.ip, &u.Lang, &u.Theme, &u.Themes, &u.vkCookies, &u.VkUser, &u.RemIP, &u.Autoplay, &u.IsAdmin)

		if err != nil {
			return result, &DBWorkerError{err, query, fmt.Sprint("getting users")}
		}

		result = append(result, u)
	}

	return result, nil
}

func (w *DBWorker) GetUserByLogin(login string) (*DBUser, *DBWorkerError) {
	query := `
		SELECT * FROM users
		WHERE login = ?
	`

	u := &DBUser{}
	err := w.conn.QueryRow(query, login).
		Scan(&u.ID, &u.login, &u.Nickanme, &u.password, &u.sessionHash, &u.ip, &u.Lang, &u.Theme, &u.Themes, &u.vkCookies, &u.VkUser, &u.RemIP, &u.Autoplay, &u.IsAdmin)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting user by login ", login)}
	}

	return u, nil
}

func (w *DBWorker) GetTrack(hash string) (*DBTrack, *DBWorkerError) {
	query := `
		SELECT * FROM music
		WHERE md5 = ?
	`

	t := &DBTrack{}
	err := w.conn.QueryRow(query, hash).Scan(&t.Md5, &t.Artist, &t.Title, &t.HasImage, &t.Lyrics, &t.Timestamp, &t.Duration)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting track by hash ", hash)}
	}

	return t, nil
}

func (w *DBWorker) GetTracks() (map[string]*DBTrack, *DBWorkerError) {
	query := `
		SELECT * FROM music
		ORDER BY timestamp DESC
	`

	result := make(map[string]*DBTrack, 0)
	rows, err := w.conn.Query(query)

	if err != nil {
		return result, &DBWorkerError{err, query, fmt.Sprint("getting tracks")}
	}

	for rows.Next() {
		t := &DBTrack{}
		err = rows.Scan(&t.Md5, &t.Artist, &t.Title, &t.HasImage, &t.Lyrics, &t.Timestamp, &t.Duration)

		if err != nil {
			return result, &DBWorkerError{err, query, fmt.Sprint("getting tracks")}
		}

		result[t.Md5] = t
	}

	return result, nil
}

func (w *DBWorker) GetTracksByHashes(hashes []interface{}) ([]*DBTrack, *DBWorkerError) {
	query := fmt.Sprintf(`
		SELECT * FROM music
		WHERE md5 IN (%v?)
	`, strings.Repeat("?,", len(hashes)-1))

	result := []*DBTrack{}
	rows, err := w.conn.Query(query, hashes...)

	if err != nil {
		return result, &DBWorkerError{err, query, fmt.Sprintf("getting tracks by hashes: %v", hashes)}
	}

	for rows.Next() {
		t := &DBTrack{}
		err := rows.Scan(&t.Md5, &t.Artist, &t.Title, &t.HasImage, &t.Lyrics, &t.Timestamp, &t.Duration)

		if err != nil {
			return result, &DBWorkerError{err, query, fmt.Sprintf("getting tracks by hashes: %v", hashes)}
		}

		result = append(result, t)
	}

	return result, nil
}

func (w *DBWorker) GetPlaylists(owner_id int) ([]*DBPlaylist, *DBWorkerError) {
	query := `
		SELECT * FROM playlists 
		WHERE owner_id = ?
	`

	result := []*DBPlaylist{}
	rows, err := w.conn.Query(query, owner_id)

	if err != nil {
		return result, &DBWorkerError{err, query, fmt.Sprint("getting playlists of user ", owner_id)}
	}

	for rows.Next() {
		p := &DBPlaylist{}
		err := rows.Scan(&p.ID, &p.Name, &p.ownerID, &p.Tracks)

		if err != nil {
			return result, &DBWorkerError{err, query, fmt.Sprint("getting playlists of user ", owner_id)}
		}

		result = append(result, p)
	}

	return result, nil
}

func (w *DBWorker) GetPlaylist(id int) (*DBPlaylist, *DBWorkerError) {
	query := `
		SELECT * FROM playlists
		WHERE id = ?
	`

	p := &DBPlaylist{}
	err := w.conn.QueryRow(query, id).Scan(&p.ID, &p.Name, &p.ownerID, &p.Tracks)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting playlist ", id)}
	}

	return p, nil
}

func (w *DBWorker) GetLibraryPlaylist(owner_id int) (*DBPlaylist, *DBWorkerError) {
	query := `
		SELECT * FROM playlists
		WHERE owner_id = ?
		AND name = ?
	`

	p := &DBPlaylist{}
	err := w.conn.QueryRow(query, owner_id, config.AllPlaylistKey).Scan(&p.ID, &p.Name, &p.ownerID, &p.Tracks)

	if err != nil {
		return nil, &DBWorkerError{err, query, fmt.Sprint("getting library playlist of owner ", owner_id)}
	}

	return p, nil
}
