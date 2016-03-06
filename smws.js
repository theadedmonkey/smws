var request = require('request');
var cheerio = require('cheerio');
var smws = require('commander');
var path = require('path');
var fs = require('fs');
var url = require('url');

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

function download(uri, filename, cb) {
  request(uri)
    .pipe(fs.createWriteStream(filename))
    .on('close', cb);
};




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


    var links = [];

    $titles.each(function(i, el) {

      var wallpaper = {
        title: '',
        resolutions: []
      };

      wallpaper.title = $(el).text();

      var $resolutions = $(el)
        .nextAll('ul')
        .first()
        .find('li:contains("without calendar")')
        .find('> a')

      var link = $resolutions
         .filter(function(i, el) {
           return $(el)
             .attr('title')
             .indexOf(smws.resolution) > -1
         })

      links.push(link.attr('href'));


      //$links.each(function(i, el) {
      //  console.log($(el).attr('href'))
      //})

      $resolutions.each(function(i, el) {
        wallpaper.resolutions.push($(el).text())
      });

      wallpapers.push(wallpaper);

    });

    // remove all falsy values
    var newLinks = [];
    for ( var i = 0; i < links.length; i++ ) {
      if ( links[i] ) {
        newLinks.push(links[i])
      }
    }

    //console.log(newLinks.length)
    //newLinks.map(console.log)

    for ( var i = 0; i < newLinks.length; i++ ) {
      download(newLinks[i], path.join(__dirname, 'wallpapers', i + '.jpg'), function() {
        console.log('done')
      })
    }

    //wallpapers.map(function(wallpaper) {
    //  console.log(wallpaper.title);
    //  console.log(wallpaper.resolutions);
    //  console.log('-------------------');
    //});


  }
})
