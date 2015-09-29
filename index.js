require('newrelic');

// ----------------------------------------------------------------------------

var async            = require('async');
var express          = require('express');
var stringCapitalize = require('string-capitalize');
var traktApi         = require('trakt-api');

// ----------------------------------------------------------------------------

// var bittorrentTracker = require('bittorrent-tracker');
// var parseTorrent      = require('parse-torrent');

// //var torrent = parseTorrent('magnet:?xt=urn:btih:60B101018A32FBDDC264C1A2EB7B7E9A99DBFB6A&dn=mad+max+fury+road+2015+720p+brrip+x264+yify&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337');
// var torrent = parseTorrent('magnet:?xt=urn:btih:F416D09751E31AF210A28D8B56F7BD95BB79017C&dn=terminator+genisys+2015+720p+brrip+x264+yify&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337');
// var client  = new bittorrentTracker(new Buffer('01234567890123456789'), 6881, torrent);

// client.on('error', function (err) {
//   // fatal client error!
//   console.log(err.message);
// });

// client.scrape();

// client.on('scrape', function (data) {
//   console.log('got a scrape response from tracker: ' + data.announce)
//   console.log('number of seeders in the swarm: ' + data.complete)
//   console.log('number of leechers in the swarm: ' + data.incomplete)
//   console.log('number of total downloads of this torrent: ' + data.incomplete)
// });

// ----------------------------------------------------------------------------

var app = express();

app.set('json spaces', 2);

app.get('/', function(req, res) {
  res.send('');
});

var host   = process.env.IP || '0.0.0.0'
var port   = process.env.PORT || 8080;
var server = app.listen(port, host, function() {
  console.log('[scrapyard] Starting on %s:%s', host, port);
});

function shutdown() {
  console.log('[scrapyard] Stopping');
  process.exit();
}

process.on('SIGINT', function() {
  shutdown();
});

process.on('SIGTERM', function() {
  shutdown();
});

// ----------------------------------------------------------------------------

var trakt = traktApi('64cf92c702ff753cc14a6d421824efcd32f22058f79bf6d637fa92e23229f35f', { 'logLevel': 'info'});

// ----------------------------------------------------------------------------
// Movies
// ----------------------------------------------------------------------------

function getMovieInfo(traktSlug, peopleNeeded, callback) {
  trakt.movie(traktSlug, { 'extended': 'full,images' }, function(err, movieData) {
    if (err)
      callback(err);
    else {
      var movieInfo = {
        'trakt_slug':     movieData['ids']['slug'],
        'imdb_id':        movieData['ids']['imdb'],
        'title':          movieData['title'],
        'year':           movieData['year'],
        'overview':       movieData['overview'],
        'tagline':        movieData['tagline'],
        'thumb':          movieData['images']['poster']['full'],
        'art':            movieData['images']['fanart']['full'],
        'runtime':        (parseInt(movieData['runtime']) * 60 * 1000) || 0,
        'genres':         movieData['genres'].map(function(x) { return stringCapitalize(x); }),
        'rating':         movieData['rating'],
        'released':       movieData['released'],
        'certification':  movieData['certification']
      };

      if (peopleNeeded) {
        trakt.moviePeople(traktSlug, { 'extended': 'images' }, function(err, peopleData) {
          if (err)
            callback(err);
          else {
            movieInfo['cast'] = [];
            if ('cast' in peopleData)
              for (var i = 0; i < peopleData['cast'].length; i++) {
                movieInfo['cast'].push({
                  'name':       peopleData['cast'][i]['person']['name'],
                  'headshot':   peopleData['cast'][i]['person']['images']['headshot']['full'],
                  'character':  peopleData['cast'][i]['character']
                });
            }

            movieInfo['crew'] = { 'directing': [], 'production': [], 'writing': [] };
            if ('crew' in peopleData) {
              if ('directing' in peopleData['crew'])
                for (var i = 0; i < peopleData['crew']['directing'].length; i++) {
                  movieInfo['crew']['directing'].push({
                    'name':     peopleData['crew']['directing'][i]['person']['name'],
                    'headshot': peopleData['crew']['directing'][i]['person']['images']['headshot']['full'],
                    'job':      peopleData['crew']['directing'][i]['job']
                  });
                }

              if ('production' in peopleData['crew'])
                for (var i = 0; i < peopleData['crew']['production'].length; i++) {
                  movieInfo['crew']['production'].push({
                    'name':     peopleData['crew']['production'][i]['person']['name'],
                    'headshot': peopleData['crew']['production'][i]['person']['images']['headshot']['full'],
                    'job':      peopleData['crew']['production'][i]['job']
                  });
                }

              if ('writing' in peopleData['crew'])
                for (var i = 0; i < peopleData['crew']['writing'].length; i++) {
                  movieInfo['crew']['writing'].push({
                    'name':     peopleData['crew']['writing'][i]['person']['name'],
                    'headshot': peopleData['crew']['writing'][i]['person']['images']['headshot']['full'],
                    'job':      peopleData['crew']['writing'][i]['job']
                  });
                }
            }

            callback(null, movieInfo);
          }
        });
      }
      else
        callback(null, movieInfo);
    }
  });
}

function parseMovieListData(movieListData, callback) {
  async.map(movieListData,
  function(movieData, callback) {
    var traktSlug = ('movie' in movieData) ? movieData['movie']['ids']['slug'] : movieData['ids']['slug'];
    getMovieInfo(traktSlug, false, callback);
  },
  callback);
}

app.get('/api/movies/popular', function(req, res) {
  var page = parseInt(req.query.page) || 1;

  trakt.moviePopular({ 'page': page, 'limit': 31 }, function(err, movieListData) {
    if (err)
      res.sendStatus(err['statusCode']);
    else
      parseMovieListData(movieListData, function(err, movieInfos) {
        if (err)
            res.sendStatus(err['statusCode']);
          else
            res.send({ 'movies': movieInfos });
      });
  });
});

app.get('/api/movies/trending', function(req, res) {
  var page = parseInt(req.query.page) || 1;

  trakt.movieTrending({ 'page': page, 'limit': 31 }, function(err, movieListData) {
    if (err)
      res.sendStatus(err['statusCode']);
    else
      parseMovieListData(movieListData, function(err, movieInfos) {
        if (err)
            res.sendStatus(err['statusCode']);
          else
            res.send({ 'movies': movieInfos });
      });
  });
});

app.get('/api/movies/search', function(req, res) {
  var query = req.query.query || '';

  trakt.searchMovie(query, function(err, movieListData) {
    if (err)
      res.sendStatus(err['statusCode']);
    else
      parseMovieListData(movieListData, function(err, movieInfos) {
        if (err)
            res.sendStatus(err['statusCode']);
          else
            res.send({ 'movies': movieInfos });
      });
  });
});

app.get('/api/movie/:trakt_slug', function(req, res) {
  getMovieInfo(req.params.trakt_slug, true, function(err, movieInfo) {
    if (err)
      res.sendStatus(err['statusCode']);
    else
      res.send(movieInfo);
  });
});

// ----------------------------------------------------------------------------
// Shows
// ----------------------------------------------------------------------------

app.get('/api/shows/popular', function(req, res) {
  var page = parseInt(req.query.page) || 1;
  //res.send(page.toString());
});

app.get('/api/shows/trending', function(req, res) {
  var page = parseInt(req.query.page) || 1;
  //res.send(page.toString());
});

app.get('/api/shows/search', function(req, res) {
  var query = req.query.query || '';
  if (query)
    res.send(query);
  else
    res.sendStatus(404);
});
