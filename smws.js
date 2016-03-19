var request = require('request');
var cheerio = require('cheerio');
var R = require('ramda');
var smws = require('commander');
var path = require('path');
var fs = require('fs');
var url = require('url');

/*
 * the schema of the smashing magazine url for wallpapers:
 *
 * /2015/12/desktop-wallpaper-calendars-january-2016/
 *
 * year:  2015
 * month: 12
 * name:  desktop-wallpaper-calendars-january-2016
 *
 * /2016/01/desktop-wallpaper-calendars-february-2016/
 *
 * year:  2016
 * month: 01
 * name:  desktop-wallpaper-calendars-february-2016
 */

/*
 * TODO:
 *
 * enable multiple months
 * enable multiple years
 * enable whole years
 * enable multiple resolutions
 * work out the aspect ratio of the resolution
 * if an entered resolution not exists for a given wallpaper
 * try to find other resolutions with the same aspect ratio.
 * add a command line option to choose where to store the wallpapers
 * save wallpapers in a flat dir with a filename format to be determined
 * enable the option of with calendar or without or both
 * try to find the resolution of the user machine in order to set is as default resolution
 * find out how to make a global smws command
 * by default the app should download the wallpapers of the last month.
 * can be a nice idea to have and .smws file to store all the config with
 * things like the dir, the aspect ratio, resolution, with without calendar...
 */

smws
  .version('0.0.1')
  .option('-y, --year <n>', 'Add year', parseInt)
  .option('-m, --month <n>', 'Add month', parseInt)
  .option('-r, --resolution <n>', 'Add resolution')
  .option('-c, --calendar <n>', 'With calendar')
  .option('-a, --aspectRatio <n>', 'With aspect ratio')
  .parse(process.argv);

var monthNames = [
    'january'
  , 'february'
  , 'march'
  , 'april'
  , 'may'
  , 'june'
  , 'july'
  , 'august'
  , 'september'
  , 'november'
  , 'december'
];

function toDateSmashing(date) {
  var dateSmashing = {};
  // is january
  if ( date.month === 1 ) {
    dateSmashing.year = date.year - 1;
    dateSmashing.month = 12;
  }
  // other months
  else {
    dateSmashing.year = date.year
    dateSmashing.month = zFill(date.month - 1, 2);
  }

  return dateSmashing;
}

function zFill(number, length) {
  var numberStr = number.toString();
  return numberStr.length === length
    ? numberStr
    : zFill('0'.concat(numberStr), length)
};

function gcd(a, b) {
  return b === 0
    ? a
    : gcd(b, a % b)
}

function aspectRatio(w, h) {
  var d = gcd(w, h);
  return [w / d, h / d].join(':');

}

function download(uri, filename, cb) {
  request(uri)
    .pipe(fs.createWriteStream(filename))
    .on('close', cb);
};

//

var date = {
  year:  smws.year,
  month: smws.month
};

var dateSmashing = toDateSmashing(date);

var urlSmashing = url.resolve(
  'https://www.smashingmagazine.com', [
      dateSmashing.year
    , dateSmashing.month
    , [
        'desktop-wallpaper-calendars'
        , monthNames[date.month - 1]
        , date.year
      ].join('-')
  ].join('/')
);

/*
 * Smashing magazine DOM structure:
 *
 * wallpaper
 *   h3      -> wallpaper title
 *   li      -> wallpaper images link list (cal/nocal)
 *   > a     -> wallpaper images link item
 *   a.href  -> wallpaper image
 */

/*
 * returns a jquery list with all wallpaper titles.
 */
function fetchHeadings($body) {
  return $body
    .find('h3')
    .filter(function(i, el) {
      return $(el)
        .attr('id')
    })
    .filter(function(i, el) {
      return $(el)
        .prop('id')
        .indexOf(zFill(date.month, 2) + '-' + date.year) > -1
    })
};

/*
 * returns a jquery list of links for a given wallpaper title.
 */
function fetchLinks($headings) {
  return $headings.map(function(i, heading) {
    return $(heading)
      .nextAll('ul')
      .first()
      .find('li')
      /*
       * each wallpaper has three li, the first one contains a link
       * with the wallpaper preview, so it is skipped.
       */
      .not(function(i, el) {
        return $(el).index() === 0
      })
      .find('> a')
  });
};

function getTitles($links) {
  return $links.map(function(i, el) {
    var $firstLink = $(el).first();
    return url
      .parse($firstLink.prop('href'))
      .pathname
      .split('/')[3]
  }).toArray();
}

/*
 * maps a jquery list of links to a list of image objects.
 */
function getImages($links) {
  var images = $links.toArray().map(function(el) {
    return $(el).toArray().map(function(el) {
      var resolution = $(el).text().split(String.fromCharCode(215)).join('x');
      var size       = resolution.split('x');
      var width      = parseInt(size[0]);
      var height     = parseInt(size[1]);
      var href       = $(el).prop('href');

      return {
          hasCalendar: hasCalendar(href)
        , resolution:  resolution
        , width:       width
        , height:      height
        , aspectRatio: aspectRatio(width, height)
        , href:        href
      }
    })
  })

  return R.map(R.partition(byCalendar), images);
}

function hasCalendar(imageHref) {
  return imageHref.indexOf('/cal/') > -1;
};

function byCalendar(image) {
  return image.hasCalendar;
};

function byCalendarOption(image) {
  switch (smws.calendar) {
    case 'both':
      return true;
    case 'yes':
      return image.hasCalendar;
    case 'no':
      return R.not(image.hasCalendar);
  }
};

function byResolution(image) {
  return smws.resolution === image.resolution;
};

function byAspectRatio(image) {
  return smws.aspectRatio === image.aspectRatio;
}

function byIsUndefined(wallpaper) {
  return R.all(function(image) { return image === undefined }, wallpaper[1]);
}

function compareByWidth(a, b) {
  if ( a.width < b.width ) {
    return -1;
  }
  if ( a.width > b.width ) {
    return 1;
  }
  return 0;
};


function getFilepathsAndUrls(wallpaper) {
  var wallpaperTitle = wallpaper[0];
  var wallpaperImages = wallpaper[1];

  var filepathsAndUrls = R.map(function(wallpaperImage) {
    var date = [smws.year, zFill(smws.month, 2)].join('-');
    var calendar = wallpaperImage.hasCalendar ? 'calendar': 'no-calendar';
    var wallpaperFilepath = [date, calendar, wallpaperTitle].join('-');
    return [path.join(__dirname, 'wallpapers', wallpaperFilepath + '.jpg'), wallpaperImage.href]
  }, wallpaperImages)

  return filepathsAndUrls;
};

function downloadWallpapers(wallpapers) {
  wallpapers.map(function(wallpaper) {

    var filepathsAndUrls = getFilepathsAndUrls(wallpaper);

    R.map(function(filepathAndUrl) {
      var filepath = filepathAndUrl[0];
      var url      = filepathAndUrl[1];
      fs.exists(filepath, function(exists) {
        if ( exists ) {
          console.log(wallpaper[0] + ' exists\n')
        }
        else {
          request(url)
            .pipe(fs.createWriteStream(filepath))
            .on('close', function() {
              console.log(wallpaper[0], 'done\n')
            })
        }
      })
    }, filepathsAndUrls)

  });
};


function main(){
  request(urlSmashing, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);
      var $body = $('body');

      var $headings = fetchHeadings($body);
      var $links = fetchLinks($headings);
      var titles = getTitles($links);
      var images = getImages($links);

      var imagesFilter = R.compose(
          R.head
        , R.reverse
        , R.sort(compareByWidth)
        , R.filter(byAspectRatio)
      );
      var imagesFiltered  = R.map(R.map(imagesFilter), images);

      var wallpapers      = R.zip(titles, imagesFiltered);
          wallpapers      = R.partition(byIsUndefined, wallpapers);

      var wallpapersNotFound = wallpapers[0];
      var wallpapersFound    = wallpapers[1];
          wallpapersFound    = R.map(R.adjust(R.filter(byCalendarOption), 1), wallpapersFound);
        
      downloadWallpapers(wallpapersFound);
    }
  });
};

main();
