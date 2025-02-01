# The Chat DBA for Sql Server

This is an experimental chat participant that uses Copilot to query your Sql Server database.  It is based on great work done by @robconery on https://github.com/microsoft/copilot-pg

## Please Note
- This is my first foray into Node so if you see anything agregious that's why, positive criticism is welcomed.

## Step 1: Create a .env file if you don't have one

This extension looks for a `.env` file in your project root, which should have a `DATABASE_URL` setting, pointing toward the database you want to use. For example:

```
DATABASE_URL="Server=localhost;Database=chinook;User Id=<user>;Password=<password>;Encrypt=false;"
```

## Step 2: Tell Copilot what you want to see

The entire `dbo` schema of your database will be loaded up to Copilot for each query. _This is only for the prompt_; we're not storing anything.

The query can be plain English, like so (using the Chinook database):

```
@ssab Show all albums in 'Metal' genre
```

The names of the tables and any literal values should be cased properly and accurately named, otherwise Copilot will hallucinate the returns to best fit what you need.

Using the prompt above, you should see a message explaining the query and some actual SQL:

```sql
SELECT a.AlbumId, a.Title, a.ArtistId
FROM Album a
JOIN Track t ON a.AlbumId = t.AlbumId
JOIN Genre g ON t.GenreId = g.GenreId
WHERE g.Name = 'Metal';
```

This is an actual Copilot response, and it was able to be this accurate because we sent along the schema in the background.

Let's do another one, looking for albums by AC/DC:

```
@ssab Show all albums by 'Metallica'
```

Copilot's response:

```sql
SELECT Album.Title
FROM Album
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = 'Metallica';
```

```
@ssab Show the total sales amount for each genre, along with the genre's name.
```

Copilot's response:

```sql
SELECT 
    g.Name AS GenreName,
    SUM(il.UnitPrice * il.Quantity) AS TotalSalesAmount
FROM 
    Genre g
JOIN 
    Track t ON g.GenreId = t.GenreId
JOIN 
    InvoiceLine il ON t.TrackId = il.TrackId
GROUP BY 
    g.Name
ORDER BY 
    TotalSalesAmount DESC;
```



## More Than Queries, Though

You can have copilot do all kinds of thing with your database schema. Need a repository for a given table (yeah, I know, just go with it):

```
@ssab create a repository for the albums table using Node. Do it in a single file for an example that's easy to copy and paste.
```

And you should see something like this:

```js
const sql = require('mssql');

const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'your_server',
  database: 'your_database',
  options: {
    encrypt: true, // Use encryption if required
    enableArithAbort: true
  }
};

class AlbumRepository {
  async getAllAlbums() {
    try {
      let pool = await sql.connect(config);
      let result = await pool.request().query('SELECT * FROM Album');
      return result.recordset;
    } catch (err) {
      console.error('SQL error', err);
    }
  }

  async getAlbumById(albumId) {
    try {
      let pool = await sql.connect(config);
      let result = await pool.request()
        .input('AlbumId', sql.Int, albumId)
        .query('SELECT * FROM Album WHERE AlbumId = @AlbumId');
      return result.recordset[0];
    } catch (err) {
      console.error('SQL error', err);
    }
  }

  async createAlbum(title, artistId) {
    try {
      let pool = await sql.connect(config);
      let result = await pool.request()
        .input('Title', sql.NVarChar(160), title)
        .input('ArtistId', sql.Int, artistId)
        .query('INSERT INTO Album (Title, ArtistId) VALUES (@Title, @ArtistId)');
      return result.rowsAffected;
    } catch (err) {
      console.error('SQL error', err);
    }
  }

  async updateAlbum(albumId, title, artistId) {
    try {
      let pool = await sql.connect(config);
      let result = await pool.request()
        .input('AlbumId', sql.Int, albumId)
        .input('Title', sql.NVarChar(160), title)
        .input('ArtistId', sql.Int, artistId)
        .query('UPDATE Album SET Title = @Title, ArtistId = @ArtistId WHERE AlbumId = @AlbumId');
      return result.rowsAffected;
    } catch (err) {
      console.error('SQL error', err);
    }
  }

  async deleteAlbum(albumId) {
    try {
      let pool = await sql.connect(config);
      let result = await pool.request()
        .input('AlbumId', sql.Int, albumId)
        .query('DELETE FROM Album WHERE AlbumId = @AlbumId');
      return result.rowsAffected;
    } catch (err) {
      console.error('SQL error', err);
    }
  }
}

module.exports = new AlbumRepository();
```

Don't want inline SQL? Ask Copilot to build you a query builder:

```
@ssab I need a class that wraps the tables and helps build SQL queries using Node. Show examples for all tables.
```

Notice that I needed to provide explicit directions for language and also that it's for all the tables. You should see something like this:

```js
const sql = require('mssql');

class Database {
  constructor(config) {
    this.config = config;
    this.pool = new sql.ConnectionPool(config);
    this.poolConnect = this.pool.connect();
  }

  async query(queryString) {
    await this.poolConnect;
    try {
      const request = this.pool.request();
      const result = await request.query(queryString);
      return result.recordset;
    } catch (err) {
      console.error('SQL error', err);
    }
  }

  async getAlbums() {
    return this.query('SELECT * FROM Album');
  }

  async getArtists() {
    return this.query('SELECT * FROM Artist');
  }

  async getCustomers() {
    return this.query('SELECT * FROM Customer');
  }

  async getEmployees() {
    return this.query('SELECT * FROM Employee');
  }

  async getGenres() {
    return this.query('SELECT * FROM Genre');
  }

  async getInvoices() {
    return this.query('SELECT * FROM Invoice');
  }

  async getInvoiceLines() {
    return this.query('SELECT * FROM InvoiceLine');
  }

  async getMediaTypes() {
    return this.query('SELECT * FROM MediaType');
  }

  async getPlaylists() {
    return this.query('SELECT * FROM Playlist');
  }

  async getPlaylistTracks() {
    return this.query('SELECT * FROM PlaylistTrack');
  }

  async getTracks() {
    return this.query('SELECT * FROM Track');
  }
}

// Example usage:
const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'your_server',
  database: 'your_database',
  options: {
    encrypt: true, // Use encryption
    enableArithAbort: true
  }
};

const db = new Database(config);

db.getAlbums().then(albums => console.log(albums));
db.getArtists().then(artists => console.log(artists));
```


## Specific Extension Commands

You can save time and typing by using slash commands when asking `@ssab` for help. Here are a few:

 - `/conn` will prompt you for the new connection string.
 - `/out` will set the format of your results to `csv`, `json`, or `text` (ascii table)
 - `/show` shows a list of your tables in the chat window.
 - `/show [table]` will show the details of the table.
 - `/schema` helps you build your database, either starting from scratch or extending your current schema.
 - `/fix` Have a SQL error you need help with? Try using `/fix`.


## Help and Issues

Have an issue or need to report a bug? Help is always appreciated!