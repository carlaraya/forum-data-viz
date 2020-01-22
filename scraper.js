require('dotenv').config();
const cheerio = require('cheerio');
const debug = require('debug')('scraper');
const fs = require('fs').promises;
const rp = require('request-promise-native').defaults({ jar: true, followAllRedirects: true });

const TID = '28574';
const PERPAGE = '50';

const scrape = async () => {
  debug('Logging in');
  // Load home login page
  const $ = cheerio.load(await rp(process.env.DOMAIN));
  // Get any hidden fields from the home login page
  const fields = {};
  $('input').map(function(i) {
    if (this.attribs.name) {
      fields[this.attribs.name] = this.attribs.value;
    }
  });
  // Input login creds
  fields.email = process.env.EMAIL;
  fields.password = process.env.PASSWORD;
  fields.rememberMe = 'no';
  // Do the login
  const loginResult = await rp({
    method: 'POST',
    uri: process.env.DOMAIN + process.env.LOGINURI,
    form: fields
  });

  debug('Loading forum posts from file')
  // Filename of json that will store posts
  const jsonFilename = `forum_posts_${TID}.json`;
  let forumPosts;
  try {
    forumPosts = JSON.parse(await fs.readFile(jsonFilename, 'utf8'));
  } catch {
    forumPosts = [];
  }

  debug('Scraping forum posts from site')
  // Loop per paginated request
  let lastPost = forumPosts.length ? forumPosts[forumPosts.length-1].pid : 0;
  let response;
  let iters = 0;
  do {
    // GET parameters
    const queryFields = { tid: TID, perpage: PERPAGE, start_from: lastPost };
    // Query forum posts
    response = await rp({
      uri: process.env.DOMAIN + process.env.FORUMURI,
      qs: queryFields,
      json: true
    });
    // response.results may or may not exist because the end of the thread has been reached
    if (response.results) {
      // push queried posts to forumPosts array
      forumPosts.push(...response.results);
      lastPost = forumPosts[forumPosts.length-1].pid;
    }
    // write the whole json array to file
    await fs.writeFile(jsonFilename, JSON.stringify(forumPosts));

    debug(`# of iterations: ${++iters}`);
    debug(`last post date: ${forumPosts[forumPosts.length-1].added}`);
  } while (response.results);
}

scrape().catch(console.error);
