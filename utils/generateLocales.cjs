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

async function main(locale) {
  const baseFile = await fs.readFileSync('./rosey/base.json');
  const roseyJSON = JSON.parse(baseFile).keys;
  let translationsFileData = [];
  let localeData = {};
  const localePath = localesDirPath + '/' + locale + '.json';
  const translationsLocalePath = translationsDirPath + '/' + locale + '/';

  const translationsFiles = await fs.readdirSync(translationsLocalePath, {
    recursive: true,
  });

  for (item in translationsFiles) {
    const file = translationsFiles[item];
    const translationsPath = translationsLocalePath + file;

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
    // Add each obj to our locales data, excluding '_inputs' object.
    for (item in translationsFileData) {
      const page = translationsFileData[item];

      for (const key in page) {
        const translationEntry = page[key];

        // If obj doesn't exist in our locales file
        // or has a blank value, and isn't the inputs object,
        // add it with the translated value
        if (key !== '_inputs') {
          if (translationEntry) {
            console.log(translationEntry);
          }

          const isKeyMarkdown = key.slice(0, 10).includes('markdown:');

          // We need the value to be
          // any translated value that appears in translations files
          // If no value detected, write the original to value as a fallback

          if (translationEntry) {
            localeData[key] = {
              original: roseyJSON[key]?.original,
              value: isKeyMarkdown
                ? md.render(translationEntry)
                : translationEntry,
            };
          } else if (localeData[key]?.value == '') {
            localeData[key] = {
              original: roseyJSON[key]?.original,
              value: roseyJSON[key]?.original,
            };
          }
        }
        // console.log('localeData: :', localeData);
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
