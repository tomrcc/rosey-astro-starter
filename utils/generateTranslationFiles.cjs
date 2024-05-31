// TODO: Test readding stuff to blog section or a diff directory and test behaviour

// TODO: BLOG PART
// Add blog section and use the slug as a key
// Before we run the generate fs scripts, and after we run rosey generate run Rosey check
// If key has a namespace of blog see if theres anything in the check file
// If the entry has changed. grab the old and new versions and display in the comment
// Comment doesn't need highlight link, just a page link
// Add a label that says 'edited - requires updated translation'

const {
  NodeHtmlMarkdown,
  NodeHtmlMarkdownOptions,
} = require('node-html-markdown');

const fs = require('file-system');
const YAML = require('yaml');
const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);
const Diff = require('diff');

const inputFilePath = './rosey/base.json';
const translationFilesDirPath = './rosey/translations';
const baseURL = process.env.BASEURL || 'http://localhost:4321/';
let locales = process.env.LOCALES?.toLowerCase().split(',') || [
  'es-es',
  'de-de',
  'fr-fr',
];
const localesDirPath = './rosey/locales';

async function main(locale) {
  // Get the Rosey generated data
  let inputFileData = {};

  const localePath = localesDirPath + '/' + locale + '.json';
  const oldLocale = await fs.readFileSync(localePath);
  const oldLocaleData = JSON.parse(oldLocale);
  // console.log('Old locale data for the blog diff: ', oldLocaleData);

  if (fs.existsSync(inputFilePath)) {
    inputFileData = await JSON.parse(fs.readFileSync(inputFilePath)).keys;
  } else {
    console.log('rosey/base.json does not exist');
  }

  // Get all the pages that appear in the base.json
  const translationEntryKeys = Object.keys(inputFileData);
  const translationEntries = translationEntryKeys.map((key) => {
    const entry = inputFileData[key];
    return entry;
  });

  let allPages = [];

  translationEntries.forEach((entry) => {
    const entrysPages = Object.keys(entry.pages);
    entrysPages.forEach((page) => {
      allPages.push(page);
    });
  });

  const pages = allPages.reduce((accumulator, item) => {
    if (!accumulator.includes(item)) {
      accumulator.push(item);
    }
    return accumulator;
  }, []);

  // Remove translations pages no longer present in the base.json file
  const translationsLocalePath = translationFilesDirPath + '/' + locale;
  const recursivetranslationsFiles = await fs.readdirSync(
    translationsLocalePath,
    {
      recursive: true,
    }
  );

  for (file in recursivetranslationsFiles) {
    const fileNameWithExt = recursivetranslationsFiles[file];
    const filePath = translationsLocalePath + '/' + fileNameWithExt;
    const filePathExtensionless = fileNameWithExt.replace('.yaml', '');
    let fileNameHTMLFormatted = '';

    const isDirectory =
      fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory();

    if (filePathExtensionless === 'home') {
      fileNameHTMLFormatted = 'index.html';
    } else if (filePathExtensionless === '404') {
      fileNameHTMLFormatted = '404.html';
    } else {
      fileNameHTMLFormatted = filePathExtensionless + '/index.html';
    }

    isDirectory
      ? console.log(
          `🔍 Checking if ${fileNameHTMLFormatted} still exists in the pages in our base.json. ${fileNameHTMLFormatted} is a directory so doesn't get checked.`
        )
      : console.log(
          `🔍 Checking if ${fileNameHTMLFormatted} still exists in the pages in our base.json`
        );

    if (!pages.includes(fileNameHTMLFormatted) && !isDirectory) {
      console.log(
        `❌ ${fileNameHTMLFormatted}(${filePath}) doesn't exist in the pages in our base.json`
      );

      console.log(`Deleting ${filePath}`);

      await fs.unlinkSync(filePath, (err) => {
        if (err) throw err;
        console.log(`❌ ${fileNameHTMLFormatted} at ${filePath} was deleted`);
      });
    } else {
      console.log(
        `✅ ${fileNameHTMLFormatted} was present in base.json and won't be deleted`
      );
    }
  }

  // Loop through the pages present in the base.json
  for (item in pages) {
    const page = pages[item];
    // Format the page name
    const pageName = page
      .replace('/index.html', '')
      .replace('.html', '')
      .replace('index', 'home');

    // Find the page file path
    const translationFilePath =
      translationFilesDirPath + '/' + locale + '/' + pageName + '.yaml';

    let outputFileData = {};
    let cleanedOutputFileData = {};

    // Get our old translations file
    if (fs.existsSync(translationFilePath)) {
      outputFileData = await YAML.parse(
        fs.readFileSync(translationFilePath, 'utf8')
      );
    } else {
      console.log(`🔨 ${translationFilePath} does not exist, creating one now`);
      await fs.writeFileSync(translationFilePath, '_inputs: {}');
    }

    for (const inputKey in inputFileData) {
      const inputTranslationObj = inputFileData[inputKey];
      const inputTranslationObjectPages = Object.keys(
        inputTranslationObj.pages
      );

      // If input exists on this page
      if (inputTranslationObjectPages.includes(page)) {
        const originalPhrase = inputTranslationObj.original.trim();
        // Turn into markdown
        const markdownOriginal = nhm.translate(originalPhrase);
        const oldMarkdownOriginal = oldLocaleData[inputKey]?.original
          ? nhm.translate(oldLocaleData[inputKey].original)
          : '';

        // Only add the key to our output data if it still exists in base.json
        // If entry no longer exists in base.json it's content has changed in the visual editor
        const outputKeys = Object.keys(outputFileData);
        outputKeys.forEach((key) => {
          if (inputKey === key) {
            cleanedOutputFileData[key] = outputFileData[key];
          }
        });

        // If entry doesn't exist in our output file, add it
        if (!cleanedOutputFileData[inputKey]) {
          cleanedOutputFileData[inputKey] = '';
        }

        // Write the highlight string

        // Limit each phrase to 3 words
        const urlHighlighterWordLength = 3;
        // Get rid of any special characters in markdown
        // Get rid of links in the markdown
        const originalPhraseArray = markdownOriginal
          .trim()
          // Remove all md links
          .replaceAll(/(?:__[*#])|\[(.*?)\]\(.*?\)/gm, /$1/)
          // Remove special chars
          .replaceAll(/[&\/\\#,+()$~%.'":*?<>{}]/gm, '')
          .split(/[\n]+/);
        // Get the first and last line of the markdown so we only have complete lines in the highlight url
        const firstPhrase = originalPhraseArray[0];
        const lastPhrase = originalPhraseArray[originalPhraseArray.length - 1];
        const endHighlightArrayAll = lastPhrase.split(' ');

        const startHighlightArray = firstPhrase
          .split(' ')
          .slice(0, urlHighlighterWordLength);

        const endHighlightArray = endHighlightArrayAll.slice(
          endHighlightArrayAll.length - urlHighlighterWordLength,
          endHighlightArrayAll.length
        );

        const originalPhraseArrayByWord = originalPhraseArray
          .join(' ')
          .split(' ');

        // Trim and encode the resulting phrase
        const startHighlight = startHighlightArray.join(' ').trim();
        const endHighlight = endHighlightArray.join(' ').trim();

        const encodedStartHighlight = encodeURI(startHighlight);
        const encodedEndHighlight = encodeURI(endHighlight);
        const encodedOriginalPhrase = encodeURI(originalPhraseArray.join(' '));

        const pageString = page.replace('.html', '').replace('index', '');
        // Look to see if original phrase is 5 words or shorter
        // if it is fallback to the encoded original phrase for the highlight link
        const locationString =
          originalPhraseArrayByWord.length > urlHighlighterWordLength * 2
            ? `[See Context](${baseURL}${pageString}#:~:text=${encodedStartHighlight},${encodedEndHighlight})`
            : `[See Context](${baseURL}${pageString}#:~:text=${encodedOriginalPhrase})`;

        // Create the inputs obj if there is none
        if (!cleanedOutputFileData['_inputs']) {
          cleanedOutputFileData['_inputs'] = {};
        }

        // Create the page input object
        if (!cleanedOutputFileData['_inputs']['$']) {
          cleanedOutputFileData['_inputs']['$'] = {
            type: 'object',
            comment: `[Go to Page](${baseURL}${pageString})`,
            options: {
              place_groups_below: false,
              groups: [
                {
                  heading: 'Untranslated',
                  comment: `[To be translated](${baseURL}${pageString})`,
                  inputs: [],
                },
                {
                  heading: 'Translated',
                  comment: `[Already translated](${baseURL}${pageString})`,
                  inputs: [],
                },
              ],
            },
          };
        }

        // Add each entry to our _inputs obj
        const markdownTextInput =
          inputKey.slice(0, 10).includes('markdown:') ||
          inputKey.slice(0, 10).includes('blog:');

        const isStaticKeyInput = inputKey.slice(0, 10).includes('blog:');

        const diff = isStaticKeyInput
          ? Diff.diffWordsWithSpace(oldMarkdownOriginal, markdownOriginal)
          : [];

        // TODO: Only run diff if we find something in the checks.json
        let diffStringAdded = '';
        let diffStringRemoved = '';
        diff.forEach((part) => {
          // green for additions, red for deletions
          if (part.added) {
            diffStringAdded = 'ADDED: ' + diffStringAdded + part.value;
          }
          if (part.removed) {
            diffStringRemoved = 'REMOVED: ' + diffStringRemoved + part.value;
          }
        });
        const diffString = `${diffStringAdded} ${diffStringRemoved}`;

        console.log(diffString);

        const inputType = markdownTextInput
          ? 'markdown'
          : originalPhrase.length < 20
          ? 'text'
          : 'textarea';

        const options = markdownTextInput
          ? {
              bold: true,
              format: 'p h1 h2 h3 h4',
              italic: true,
              link: true,
              undo: true,
              redo: true,
              removeformat: true,
              copyformatting: true,
            }
          : {};

        const joinedComment =
          diffStringAdded.length > 0 || diffStringRemoved.length
            ? `${diffString} | ${markdownOriginal} | ${locationString}`
            : `${markdownOriginal} | ${locationString}`;

        cleanedOutputFileData['_inputs'][inputKey] = {
          label: `Translation (${locale})`,
          hidden: originalPhrase === '' ? true : false,
          type: inputType,
          options: options,
          comment: joinedComment,
        };

        // Add each entry to page object group depending on whether they are translated or not
        const unTranslatedPageGroup =
          cleanedOutputFileData['_inputs']['$'].options.groups[0].inputs;

        const translatedPageGroup =
          cleanedOutputFileData['_inputs']['$'].options.groups[1].inputs;

        if (cleanedOutputFileData[inputKey].length > 0) {
          translatedPageGroup.push(inputKey);
        } else {
          unTranslatedPageGroup.push(inputKey);
        }
      }

      await fs.writeFileSync(
        translationFilePath,
        YAML.stringify(cleanedOutputFileData),
        (err) => {
          if (err) throw err;
          console.log('✅✅ ' + translationFilePath + ' updated succesfully');
        }
      );
    }
  }
}

// Loop through locales
for (let i = 0; i < locales.length; i++) {
  const locale = locales[i];

  main(locale).catch((err) => {
    console.error(`❌❌ Encountered an error translating ${locale}:`, err);
  });
}

module.exports = { main };
