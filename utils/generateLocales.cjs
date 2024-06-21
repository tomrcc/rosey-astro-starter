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
  const baseURLsFile = await fs.readFileSync('./rosey/base.urls.json');
  const baseURLFileData = JSON.parse(baseURLsFile).keys;
  const baseURLFileDataKeys = Object.keys(baseURLFileData);
  const baseURLFileDataKeysExtensionless = baseURLFileDataKeys.map((key) => {
    return key.replace('/index.html', '');
  });

  const localePath = localesDirPath + '/' + locale + '.json';
  const localeURLsPath = localesDirPath + '/' + locale + '.urls.json';
  const translationsLocalePath = translationsDirPath + '/' + locale + '/';

  // Check if locales files exist otherwise create one
  if (!fs.existsSync(localePath)) {
    fs.writeFileSync(localePath, '{}', (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`No locale file exists for ${locale} - creating one now.`);
      }
    });
  }
  if (!fs.existsSync(localeURLsPath)) {
    fs.writeFileSync(localeURLsPath, '{}', (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`No locale file exists for ${locale} - creating one now.`);
      }
    });
  }

  const oldLocale = await fs.readFileSync(localePath);
  const oldLocaleData = JSON.parse(oldLocale);
  const oldURLsLocale = await fs.readFileSync(localeURLsPath);
  const oldURLsLocaleData = oldURLsLocale ? JSON.parse(oldURLsLocale) : {};

  let translationsFileData = [];
  let translationsPagesObj = {};
  let localeData = {};
  let localeURLsData = {};

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
          const isKeyURLTranslation = keyName === 'urlTranslation';
          const translationFileWithPageExtension =
            translationFile === '404.yaml'
              ? '404.html'
              : translationFile === 'home.yaml'
              ? 'index.html'
              : translationFile.replace('.yaml', '/index.html');

          // Write entry values to be any translated value that appears in translations files
          // If no value detected, and the locale value is an empty string, write the original to value as a fallback

          if (translationEntry) {
            // Write to the rest of the entries
            if (
              // Check if its a new translation
              translationEntry !== oldLocaleData[keyName]?.value ||
              translationEntry !== oldURLsLocaleData[keyName]?.value
            ) {
              if (!isKeyURLTranslation) {
                console.log(
                  `🔍 Detected a new translation - writing to locales: ${keyName}`
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
                console.log(
                  `🔨 Checking for any duplicate entries in other pages`
                );
                // Loop through and write any duplicate keys
                for (file in translationsFiles) {
                  const overWriteFile = translationsFiles[file];
                  const overWriteFilePath =
                    translationsLocalePath + overWriteFile;

                  let overWriteTranslationObj =
                    translationsPagesObj[overWriteFile] || {};
                  const overWriteTranslationObjData = overWriteTranslationObj;

                  const overWriteTranslationObjKeys =
                    overWriteTranslationObjData
                      ? Object.keys(overWriteTranslationObjData)
                      : [];
                  if (overWriteTranslationObjKeys.includes(keyName)) {
                    overWriteTranslationObj[keyName] = translationEntry;
                    console.log(
                      `✅ Detected a duplicate key in ${overWriteFile} - overwriting with new translation`
                    );
                    const yamlData = YAML.stringify(overWriteTranslationObj);
                    fs.writeFileSync(overWriteFilePath, yamlData, (err) => {
                      if (err) throw err;
                      console.log(
                        `✅ ${overWriteFilePath} succesfully updated duplicate key: ${keyName}`
                      );
                    });
                  }
                }
              } else {
                if (
                  // If there's a translated URL and it's a new one
                  translationEntry &&
                  translationEntry !== oldURLsLocaleData[keyName]?.value
                ) {
                  console.log(
                    `Detected a new URL translation: ${translationEntry}`
                  );
                  // Write the URL translation

                  localeURLsData[translationFileWithPageExtension] = {
                    original: translationFileWithPageExtension,
                    value: translationEntry,
                  };
                }
              }
            } else {
              // Preserve the old translation if there is one
              if (!isKeyURLTranslation) {
                localeData[keyName] = {
                  original: baseFileData[keyName]?.original,
                  value: oldLocaleData[keyName]?.value,
                };
              } else {
                localeURLsData[translationFileWithPageExtension] = {
                  original:
                    baseURLFileData[translationFileWithPageExtension]?.original,
                  value:
                    oldURLsLocaleData[translationFileWithPageExtension]?.value,
                };
              }
            }
          } else if (!isKeyURLTranslation) {
            if (
              // Provide a fallback if there's no translation so the translated page entry isn't a blank string
              localeData[keyName]?.value === '' ||
              localeData[keyName]?.value === undefined
            ) {
              localeData[keyName] = {
                original: baseFileData[keyName]?.original,
                value: baseFileData[keyName]?.original,
              };
            }
          } else {
            if (
              // Provide a fallback if there's no translated URL so the translated URL isn't a blank string
              localeURLsData[translationFileWithPageExtension]?.value === '' ||
              localeURLsData[translationFileWithPageExtension]?.value ===
                undefined
            ) {
              localeURLsData[translationFileWithPageExtension] = {
                original:
                  baseURLFileData[translationFileWithPageExtension]?.original,
                value:
                  baseURLFileData[translationFileWithPageExtension]?.original,
              };
            }
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
  // Write locales URL data
  fs.writeFileSync(localeURLsPath, JSON.stringify(localeURLsData), (err) => {
    if (err) throw err;
    console.log(`✅✅ ${localeURLsPath} + ' updated succesfully`);
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
