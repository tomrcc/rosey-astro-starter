// TODO: When we write duplicates entries to our inputs
// We need to also change the _inputs obj for that page - move the overwritten duplicate entry to the translated group

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
      const data = await fs.readFileSync(translationsPath, 'utf-8');
      // Push to an array to loop through, and an obj for seeing the current translation entry (important for dupicate entries)
      translationsFileData.push(YAML.parse(data));
      translationsPagesObj[translationFile] = YAML.parse(data);
    } else if (isDirectory) {
      console.log(`🔍 ${translationsPath} is a directory - skipping read`);
    } else {
      console.log(`❌ ${translationsPath} does not exist`);
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
          const isKeyMarkdown = keyName.slice(0, 10).includes('markdown:');
          const isKeyBlog = keyName.slice(0, 8).includes('blog:');

          // Write the value to be any translated value that appears in translations files
          // If no value detected, and the locale value is an empty string, write the original to value as a fallback

          if (translationEntry) {
            // Write to the rest of the entries
            if (translationEntry !== oldLocaleData[keyName]?.value) {
              console.log(`🔍 Detected a new translation`);
              console.log(
                `🔨 Checking for and writing to any duplicate entries`
              );
              const markdownTranslation = md.render(translationEntry);
              const localeValue =
                isKeyMarkdown || isKeyBlog
                  ? markdownTranslation
                  : translationEntry;
              // Write the value to the locales
              localeData[keyName] = {
                original: baseFileData[keyName]?.original,
                value: localeValue,
              };
              for (file in translationsFiles) {
                const overWriteFile = translationsFiles[file];
                const overWriteFilePath =
                  translationsLocalePath + overWriteFile;

                let overWriteTranslationObj =
                  translationsPagesObj[overWriteFile] || {};
                const overWriteTranslationObjData = overWriteTranslationObj;

                const overWriteTranslationObjKeys = overWriteTranslationObjData
                  ? Object.keys(overWriteTranslationObjData)
                  : [];
                if (overWriteTranslationObjKeys.includes(keyName)) {
                  overWriteTranslationObj[keyName] = translationEntry;
                  console.log(
                    `✅ Detected a duplicate key in ${file} - overwriting ${keyName} with new translation`
                  );
                  fs.writeFileSync(
                    overWriteFilePath,
                    YAML.stringify(overWriteTranslationObj),
                    (err) => {
                      if (err) throw err;
                      console.log(
                        `✅ ${overWriteFilePath} succesfully updated duplicate key: ${keyName}`
                      );
                    }
                  );
                }
              }
            } else {
              // Preserve the old translation if there is one
              localeData[keyName] = {
                original: baseFileData[keyName]?.original,
                value: oldLocaleData[keyName]?.value,
              };
            }
          } else if (
            localeData[keyName]?.value === '' ||
            localeData[keyName]?.value === undefined
          ) {
            // This is just a fallback if there's no translation
            localeData[keyName] = {
              original: baseFileData[keyName]?.original,
              value: baseFileData[keyName]?.original,
            };
          }
        }
      }
    }
  }
  // Write locales data
  fs.writeFileSync(localePath, JSON.stringify(localeData), (err) => {
    if (err) throw err;
    console.log(`✅✅ ${localePath} + ' updated succesfully`);
  });
}

// Loop through locales
for (let i = 0; i < locales.length; i++) {
  const locale = locales[i];

  main(locale).catch((err) => {
    console.error(`❌❌ Encountered an error translating ${locale}:`, err);
  });
}

module.exports = { main };
