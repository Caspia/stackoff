/**
 * Process requests from searchs page '/search'
 */
const path = require('path');
const libPath = path.join(__dirname, '..', '..', 'lib');

const html2plaintext = require('html2plaintext');
const sanitizeHtml = require('sanitize-html');
const canParam = require('can-param');
const elasticClient = require(path.join(libPath, 'elasticClient'));
const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

const client = elasticClient.client;

exports.searchGet = async function (req, res, next) {
  try {
    console.log('search term is ' + req.query.search_term);
    console.log('from is ' + req.query.from);
    if (req.query.search_term) {
      const parms = req.query.from
        ? {from: parseInt(req.query.from, 10)}
        : {};
      const searchResults = await elasticClient.search(
        client,
        'stackexchange_' + 'sepost',
        req.query.search_term,
        parms,
      );
      //console.log('search result: ' + prettyFormat(searchResults));

      let renderResults = [{title: 'No results'}]; // what we will pass to template
      // Get or fake titles
      let hitResults;
      try { hitResults = searchResults.hits.hits; } catch (err) {}
      if (hitResults && hitResults.length) {
        renderResults = hitResults.map((hitResult) => {
          const renderResult = {};
          //console.log('hitResult: ' + prettyFormat(hitResult));
          if (hitResult._source) {
            // Get a title, using Body if Title missing
            if (hitResult._source.Title) {
              renderResult.title = hitResult._source.Title;
            } else if (hitResult._source.Body) {
              const textBody = html2plaintext(hitResult._source.Body);
              renderResult.title =
                textBody.length > 60
                  ? textBody.substr(0, 60) + '...'
                  : textBody;
            }

            // Get highlight
            if (hitResult.highlight) {
              renderResult.highlight = '';
              for (const field in hitResult.highlight) {
                renderResult.highlight += sanitizeHtml(hitResult.highlight[field]);
              }
            } else {
              console.log('no highlightfound');
            }

            // Get a link to the results
            renderResult.questionId = hitResult._source.ParentId || hitResult._source.Id;
          } else {
            renderResult.title = 'Unparsable result';
          }
          //console.log('renderResult:\n' + prettyFormat(renderResult));
          return renderResult;
        });
      }

      // Next and Previous searches
      const currentFrom = parseInt(req.query.from || '0', 10);
      const nextFrom = currentFrom + 10;
      const previousFrom = currentFrom - 10;
      // encode the search term with + for spaces
      const urlPrefix = req.protocol + '://' + req.headers.host + req.path + '?'
             + canParam({search_term: req.query.search_term}) + '&from=';
      const nextUrl = urlPrefix + nextFrom;
      const previousUrl = previousFrom >= 0
        ? urlPrefix + previousFrom
        : null;

      // Show the results
      res.render('search', {
        title: 'Stack Caspia offline search',
        renderResults,
        totalHits: searchResults.hits.total,
        nextUrl,
        previousUrl,
      });
    }
  } catch (err) {
    console.log('Error in searchControl get: ' + err);
    res.render('search', {errors: [err]});
  }
};