var request = require('request');
var cheerio = require('cheerio');
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

console.log(urlSmashing);

request(urlSmashing, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var $ = cheerio.load(body);
    var $body = $('body');

    // list of all wallpapers
    var wallpapers = [];

    // list of h3
    var $titles = $body
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


    var imagesToDownload = [];

    $titles.each(function(i, el) {

      var wallpaper = {
        title: '',
        images: []
      };

      wallpaper.title = $(el).text();

      var $resolutionsUl = $(el)
        .nextAll('ul')
        .first()

      var $resolutionsLists = $resolutionsUl
        .find('li')
        .filter(function(i, el) {
          return $(el).text().indexOf('without calendar') > -1 || $(el).text().indexOf('with calendar') > -1
        })

      $resolutionsLists.each(function(i, el) {
        var $resolutions = $(el).find('> a');

        wallpaper.images = [];

        $resolutions.each(function(i, el) {
          var resolution = $(el).text();
          var size = resolution.split(String.fromCharCode(215));

          wallpaper.images.push({
            resolution:  resolution,
            width:       size[0],
            height:      size[1],
            aspectRatio: aspectRatio(size[0], size[1]),
            href:        $(el).attr('href')
          });

        });

        // filter by aspect ratio, sort by width and take the first
        // one ( the image with higher width )
        var targetSize = smws.resolution.split('x');
        var targetAspectRatio = aspectRatio(targetSize[0], targetSize[1]);
        var image = wallpaper.images
          .filter(function(image) {
            return image.aspectRatio == targetAspectRatio
          })
          .sort(sortByWidth)[0]

        if ( image ) {
          imagesToDownload.push(image);
          wallpapers.push(image)
        }

      });

    });

    for ( var i = 0; i < imagesToDownload.length; i++ ) {
      download(imagesToDownload[i].href, path.join(__dirname, 'wallpapers', i + '.jpg'), function() {
        console.log('done')
      })
    }

    //wallpapers.map(function(image) {
      //console.log('title: ' + wallpaper.title);

      //wallpaper.images.map(function(image) {
        //console.log('resolution: '   + image.resolution);
        //console.log('size: '         + image.width, image.height);
        //console.log('aspect ratio: ' + image.aspectRatio);
        //console.log('href: '         + image.href);
      //});

      //console.log('-------------------');
    //});


  }
})
