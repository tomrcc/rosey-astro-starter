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
  const baseFileData = JSON.parse(baseFile).keys;

  const localePath = localesDirPath + '/' + locale + '.json';
  const oldLocale = await fs.readFileSync(localePath);
  const oldLocaleData = JSON.parse(oldLocale);

  const translationsLocalePath = translationsDirPath + '/' + locale + '/';

  let translationsFileData = [];
  let translationsPagesObj = {};
  let localeData = {};

  const translationsFiles = await fs.readdirSync(translationsLocalePath, {
    recursive: true,
  });

  // Loop through each file in the translations directory
  for (file in translationsFiles) {
    const translationFile = translationsFiles[file];
    const translationsPath = translationsLocalePath + translationFile;

    // Read files if not directory and add each pages as an obj to
    const isDirectory =
      fs.existsSync(translationsPath) &&
      fs.lstatSync(translationsPath).isDirectory();

    if (fs.existsSync(translationsPath) && !isDirectory) {
      const data = YAML.parse(fs.readFileSync(translationsPath, 'utf-8'));
      console.log(
        `Pushing ${data} to translationsFileData, which now reads has ${translationsFileData.length} pages worth of translations data`
      );
      // Push to an array to loop through, and an obj for seeing the current translation entry (important for dupicate entries)
      translationsFileData.push(data);
      translationsPagesObj[translationFile] = data;
    } else if (isDirectory) {
      console.log(`${translationsPath} is a directory - skipping read`);
    } else {
      console.log(`${translationsPath} does not exist`);
    }

    // Check if theres a translation and
    // Add each obj to our locales data, excluding '_inputs' object.
    for (obj in translationsFileData) {
      const pageObj = translationsFileData[obj];
      const pageKeys = Object.keys(pageObj);

      for (const key in pageKeys) {
        const keyName = pageKeys[key];
        const translationEntry = pageObj[keyName];

        if (keyName !== '_inputs') {
          const isKeyMarkdown = key.slice(0, 10).includes('markdown:');

          // Write the value to be any translated value that appears in translations files
          // If no value detected, and the locale value is an empty string, write the original to value as a fallback

          if (translationEntry) {
            // Write the value to the locales
            localeData[keyName] = {
              original: baseFileData[keyName]?.original.trim(),
              value: isKeyMarkdown
                ? md.render(translationEntry).trim()
                : translationEntry.trim(),
            };
            console.log(`Added ${localeData[keyName]} to localesData`);
            // TODO: Write the translation to other inputs that share the same key
            // 1. If we change the value on any translation input
            ////  a. it has to be different to whats in the current locales value otherwise we'll trigger the overwrite on old translations that have been put there with an overwrite (meaning we could never change duplicate inputs after an initial entry was made)
            console.log(oldLocaleData[keyName]);
            if (translationEntry != oldLocaleData[keyName].value) {
              console.log('New translation entry');
              console.log(
                `Writing ${localeData[keyName]} to duplicate translation entries`
              );
              // 2. Loop through all the translations pages
              //// a. Write to the translations pages obj when we fetch data 👆
              //// Get the pages data
              //// Check if it's the current page and skip if it is
              //// Check if the page has the translated value's key
              //// If it does, change the keys value to the new translation
              //// Write the translation file with the new translation
              //// Write back to each translation page using the keys from the translationsPagesObj
              //// Warning: Don't get confused with writing translation pages here and writing the locales in the rest of this file
              for (file in translationsFiles) {
                console.log('Old translation: ', translationsPagesObj[file]);
              }
            }
            //// To make sure we're not detecting an already overwritten key and retriggering the loop over and over
            //// a. Push to an array at the locale level of key names that keeps track of if we've overwritten this round of saves
            //// Only possible hiccup I can see here is if two conflicting entries are made on duplicate inputs on one round of translations
            //// Shouldn't be too bad - just means first one detected will win since the key will be in the array and the loop wont run
            //// b. If the entry isn't in the alreadyOverwritten array, and the entry value is different to the value currently in the locales file
            //// c. We can then proceed with the overwrite loop, and can also write the entry to localeData
            // 3. Write to the same key the value we just detected was a new translation
          } else if (
            localeData[keyName]?.value == '' ||
            localeData[keyName]?.value == undefined
          ) {
            // This is just a fallback if there's no translation
            console.log(`Writing original to value to prevent a blank value`);
            localeData[keyName] = {
              original: baseFileData[keyName]?.original.trim(),
              value: baseFileData[keyName]?.original.trim(),
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
