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
 * things like the dir.
 */

smws
  .version('0.0.1')
  .option('-y, --year <n>', 'Add year', parseInt)
  .option('-m, --month <n>', 'Add month', parseInt)
  .option('-r, --resolution <n>', 'Add resolution')
  .option('-c, --calendar <n>', 'With calendar')
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

/*
 * rename to compareByWith
 */
function sortByWidth(a, b) {
  if ( a.width < b.width ) {
    return -1;
  }
  if ( a.width > b.width ) {
    return 1;
  }
  return 0;
};

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
function titles() {
  return $('body')
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
function byCalendar(i, el) {
  var calendarText = $(el).text();

  var hasCalendar    = calendarText.indexOf('with calendar') > -1;
  var notHasCalendar = calendarText.indexOf('without calendar') > -1;

  switch (smws.calendar) {
    case 'both':
      return hasCalendar || notHasCalendar;
    case 'yes':
      return hasCalendar;
    case 'no':
      return notHasCalendar;
   }
}
*/

/*
 * returns a jquery list of links for a given wallpaper title.
 */
function wallpaperLinks($title) {
  return $title
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
};

/*
 * maps a jquery list of links to a list of image objects.
 */
function linksToImages($links) {
  return $links.map(function() {

    var resolution = $(this).text().split(String.fromCharCode(215)).join('x');
    var size       = resolution.split('x');
    var href       = $(this).prop('href');

    return {
        hasCalendar: hasCalendar(href)
      , resolution:  resolution
      , width:       size[0]
      , height:      size[1]
      , aspectRatio: aspectRatio(size[0], size[1])
      , href:        href
    }

  });
}

function hasCalendar(imageHref) {
  return imageHref.indexOf('/cal/') > -1;
};

function byCalendar(image) {
  switch (smws.calendar) {
    case 'both':
      return true;
    case 'yes':
      return image.hasCalendar;
    case 'no':
      return !image.hasCalendar;
   }
};

function byResolution(image) {
  return smws.resolution === image.resolution;
};

function byIsEmpty(wallpaper) {
  return R.isEmpty(wallpaper[1]);
}

function main(){
  request(urlSmashing, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);

      var $titles = titles();
      var $wallpapersLinks = $titles.map(function(i, title) {
        return wallpaperLinks($(title))
      });
      var $wallpapersImages = $wallpapersLinks.map(function(i, wallpaperLinks) {
        return linksToImages($(wallpaperLinks));
      });

      /*
       * cheerio not implement .makeArray jquery function
       * so i have to convert the jquery array-like object
       * to a standar js array manually.
       */
      var wallpapersImages = [];
      $wallpapersImages.each(function(i, el) {
        wallpapersImages.push($(el).toArray())
      });

      var filterImages = R.compose(R.filter(byResolution), R.filter(byCalendar));
      var wallpapersImagesFiltered = R.map(filterImages, wallpapersImages);

      var wallpaperTitles = $wallpapersLinks.map(function(i, wallpaperLinks) {
        var $firstLink = $(wallpaperLinks).first();
        return url
          .parse($firstLink.prop('href'))
          .pathname
          .split('/')[3]
      }).toArray();

      var wallpapers = R.zip(wallpaperTitles, wallpapersImagesFiltered);
          wallpapers = R.partition(byIsEmpty, wallpapers);

      var wallpapersNotFound = wallpapers[0];
      var wallpapersFound    = wallpapers[1];

      console.log('the following wallpapers has been found with resolution %s\n', smws.resolution);
      console.log(
        R.map(function(wallpaper) { return wallpaper[0] }, wallpapersFound)
      );

      console.log('the following wallpapers has been not found with resolution %s\n', smws.resolution);
      console.log(
        R.map(function(wallpaper) { return wallpaper[0] }, wallpapersNotFound)
      );


    }
  });
};

main();
