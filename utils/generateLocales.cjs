// TODO: BLOG & LONG FORM ENTRIES
// Add blog section and use the slug as a key
// Run Rosey check - Before we run the generate fs scripts, and after we run rosey generate
// If key has a namespace of blog see if theres anything in the check file
// If the entry has changed. grab the old and new versions and display in the comment
// Comment doesn't need highlight link, just a page link
// Add a label that says 'edited - requires updated translation'

const fs = require('file-system');
const YAML = require('yaml');
const markdownit = require('markdown-it');
const md = markdownit();

const translationsDirPath = './rosey/translations';
const localesDirPath = './rosey/locales';

const locales = process.env.LOCALES?.toLowerCase().split(',') || [
  'es-es',
  'de-de',
  'fr-fr',
];

// The generateLocales function runs on each separate locale
async function main(locale) {
  const baseFile = await fs.readFileSync('./rosey/base.json');
  const roseyJSON = JSON.parse(baseFile).keys;
  const localePath = localesDirPath + '/' + locale + '.json';
  const translationsLocalePath = translationsDirPath + '/' + locale + '/';
  let translationsFileData = [];
  let localeData = {};

  const translationsFiles = await fs.readdirSync(translationsLocalePath, {
    recursive: true,
  });
  // Loop through each file in the locales directory
  for (file in translationsFiles) {
    const translationFile = translationsFiles[item];
    const translationsPath = translationsLocalePath + translationFile;

    // Read files if not directory and add each pages an obj
    console.log(`Reading file ${translationsPath}`);
    const isDirectory =
      fs.existsSync(translationsPath) &&
      fs.lstatSync(translationsPath).isDirectory();
    if (fs.existsSync(translationsPath) && !isDirectory) {
      const data = YAML.parse(fs.readFileSync(translationsPath, 'utf-8'));
      translationsFileData.push(data);
    } else if (isDirectory) {
      console.log(`${translationsPath} is a directory - skipping read`);
    } else {
      console.log(`${translationsPath} does not exist`);
    }
    // Check if theres a translation and
    // Add each obj to our locales data, excluding '_inputs' object.
    for (item in translationsFileData) {
      const page = translationsFileData[item];

      for (const key in page) {
        const translationEntry = page[key];

        // If obj doesn't exist in our locales file
        // or has a blank value, and isn't the inputs object,
        // add it with the translated value
        if (key !== '_inputs') {
          // if (translationEntry) {
          //   console.log(translationEntry);
          // }

          const isKeyMarkdown = key.slice(0, 10).includes('markdown:');

          // Write the value to be any translated value that appears in translations files
          // If no value detected, and the locale value is an empty string, write the original to value as a fallback

          if (translationEntry) {
            // TODO:
            // Write the value to other translations files that have the same key
            // 1. If we change the value on any translation input and its different to whats in the current locales value thats the new translation
            // 2. Loop through all the translations pages
            //// To make sure we're not detecting an already overwritten key and retriggering the loop over and over
            //// a. Push to an array of objects that keeps track of if we've overwritten this round of saves
            //// b. If the entry isn't in the alreadyOverwritten array, and the entry value is different to the value currently in the locales file
            //// c. We can then proceed with the overwrite loop, and can also write the entry to localeData
            // 3. Write to the same key the value we just detected was a new translation

            // Write the value to the locales
            localeData[key] = {
              original: roseyJSON[key]?.original,
              value: isKeyMarkdown
                ? md.render(translationEntry)
                : translationEntry,
            };
          } else if (localeData[key]?.value == '') {
            // This is just a fallback if there's no translation
            localeData[key] = {
              original: roseyJSON[key]?.original,
              value: roseyJSON[key]?.original,
            };
          }
        }
      }
    }
  }
  // Write locales data
  fs.writeFileSync(localePath, JSON.stringify(localeData), (err) => {
    if (err) throw err;
    console.log(localePath + ' updated succesfully');
  });
}

// Loop through locales
for (let i = 0; i < locales.length; i++) {
  const locale = locales[i];

  main(locale).catch((err) => {
    console.error(`Encountered an error translating ${locale}:`, err);
  });
}

module.exports = { main };
