const fs = require('fs');
const YAML = require('yaml');
const {
  NodeHtmlMarkdown,
  NodeHtmlMarkdownOptions,
} = require('node-html-markdown');
const nhm = new NodeHtmlMarkdown(
  /* options (optional) */ {},
  /* customTransformers (optional) */ undefined,
  /* customCodeBlockTranslators (optional) */ undefined
);
const Diff = require('diff');
const path = require('path');

const inputFilePath = './rosey/base.json';
const inputURLFilePath = './rosey/base.urls.json';
const translationFilesDirPath = './rosey/translations';
const localesDirPath = './rosey/locales';

const baseURL = process.env.BASEURL || 'http://localhost:4321/';
let locales = process.env.LOCALES?.toLowerCase().split(',') || [
  'es-es',
  'de-de',
  'fr-fr',
];

function initDefaultInputs(data) {
  // Create the inputs obj if there is none
  if (!data['_inputs']) {
    data['_inputs'] = {};
  }

  // Create the page input object
  if (!data['_inputs']['$']) {
    data['_inputs']['$'] = {
      type: 'object',
      comment: `[See ${pageString}](${baseURL}${pageString})`,
      options: {
        place_groups_below: false,
        groups: [
          {
            heading: `Still to translate (${locale})`,
            comment: `Text to translate on [${pageString}](${baseURL}${pageString})`,
            inputs: [],
          },
          {
            heading: `Already translated (${locale})`,
            comment: `Text already translated on [${pageString}](${baseURL}${pageString})`,
            inputs: [],
          },
        ],
      },
    };
  }
}

function getTranslationHTMLFilename(translationFilename) {
  if (translationFilename === '404.yaml') {
    return '404.html';
  }

  if (translationFilename === 'home.yaml') {
    return 'index.html';
  }

  return translationFilename.replace('.yaml', '/index.html');
}

async function isDirectory(filepath) {
  const stat = await fs.promises.stat(filepath);

  return stat.isDirectory();
}

async function readFileWithFallback(filepath, fallbackString) {
  try {
    const buffer = await fs.promises.readFile(filepath);
    return buffer.toString('utf-8') || fallbackString;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return fallbackString;
    }
    throw err;
  }
}

async function readJsonFromFile(filepath) {
  const contents = await readFileWithFallback(filepath, '{}');
  return JSON.parse(contents);
}

function generateLocationString(markdownOriginal, page) {
  // Limit each phrase to 3 words
  const urlHighlighterWordLength = 3;
  // Get rid of any special characters in markdown
  // Get rid of links in the markdown
  const originalPhraseTidied = markdownOriginal
    .trim()
    // Remove all md links
    .replaceAll(/(?:__[*#])|\[(.*?)\]\(.*?\)/gm, /$1/)
    // Remove special chars
    .replaceAll(/[&\/\\#,+()$~%.":*?<>{}]/gm, '');
  const originalPhraseArray = originalPhraseTidied.split(/[\n]+/);
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

  const originalPhraseArrayByWord = originalPhraseArray.join(' ').split(' ');

  // Trim and encode the resulting phrase
  const startHighlight = startHighlightArray.join(' ').trim();
  const endHighlight = endHighlightArray.join(' ').trim();

  const encodedStartHighlight = encodeURI(startHighlight);
  const encodedEndHighlight = encodeURI(endHighlight);
  const encodedOriginalPhrase = encodeURI(originalPhraseArray.join(' '));

  const pageString = page.replace('.html', '').replace('index', '');
  // Look to see if original phrase is 5 words or shorter
  // if it is fallback to the encoded original phrase for the highlight link
  return originalPhraseArrayByWord.length > urlHighlighterWordLength * 2
    ? `[See on page](${baseURL}${pageString}#:~:text=${encodedStartHighlight},${encodedEndHighlight})`
    : `[See on page](${baseURL}${pageString}#:~:text=${encodedOriginalPhrase})`;
}

async function main(locale) {
  // Get the Rosey generated data

  const localePath = path.join(localesDirPath, locale, '.json');
  const oldLocaleData = await readJsonFromFile(localePath);
  const inputFileData = await readJsonFromFile(inputFilePath);
  const inputURLFileData = await readJsonFromFile(inputURLFilePath);

  const pages = Object.keys(inputURLFileData.keys);

  const translationsLocalePath = path.join(translationFilesDirPath, locale);
  const translationsFiles = await fs.promises.readdir(translationsLocalePath, {
    recursive: true,
  });
  console.log(pages);

  await Promise.all(
    translationsFiles.map(async (fileNameWithExt) => {
      const filePath = path.join(translationsLocalePath, fileNameWithExt);

      if (await isDirectory(filePath)) {
        return;
      }

      const fileNameHTMLFormatted = getTranslationHTMLFilename(fileNameWithExt);

      // Remove translations pages no longer present in the base.json file
      if (!pages.includes(fileNameHTMLFormatted)) {
        console.log(
          `❌ Deleting ${fileNameHTMLFormatted}(${filePath}), since it doesn't exist in the pages in our base.json`
        );

        await fs.promises.unlink(filePath);
        console.log(`❌ ${fileNameHTMLFormatted} at ${filePath} was deleted`);
      }
    })
  );

  // Loop through the pages present in the base.json
  await Promise.all(
    pages.map(async (page) => {
      // Format the page name
      const pageName = page
        .replace('/index.html', '')
        .replace('.html', '')
        .replace('index', 'home');

      // Find the page file path
      const translationFilePath = path.join(
        translationFilesDirPath,
        locale,
        `${pageName}.yaml`
      );

      let cleanedOutputFileData = {};

      const translationFileString = await readFileWithFallback(
        translationFilePath,
        '_inputs: {}'
      );
      const translationFileData = await YAML.parse(translationFileString);

      // Create the url key if there is none
      if (translationFileData['urlTranslation'].length > 0) {
        cleanedOutputFileData['urlTranslation'] =
          translationFileData['urlTranslation'];
      } else {
        cleanedOutputFileData['urlTranslation'] = page;
      }

      initDefaultInputs(cleanedOutputFileData);

      inputFileData.keys.forEach((inputKey) => {
        const inputTranslationObj = inputFileData.keys[inputKey];
        // If input exists on this page
        if (!inputTranslationObj.pages[page]) {
          return;
        }

        const originalPhrase = inputTranslationObj.original.trim();
        // Turn into markdown
        const markdownOriginal = nhm.translate(originalPhrase);
        const oldMarkdownOriginal = oldLocaleData[inputKey]?.original
          ? nhm.translate(oldLocaleData[inputKey].original)
          : '';

        // Only add the key to our output data if it still exists in base.json
        // If entry no longer exists in base.json it's content has changed in the visual editor
        Object.keys(translationFileData).forEach((key) => {
          if (inputKey === key) {
            cleanedOutputFileData[key] = translationFileData[key];
          }
        });

        // If entry doesn't exist in our output file, add it
        if (!cleanedOutputFileData[inputKey]) {
          cleanedOutputFileData[inputKey] = '';
        }

        // Write the highlight string

        // Add each entry to our _inputs obj
        const markdownTextInput =
          inputKey.slice(0, 10).includes('markdown:') ||
          inputKey.slice(0, 10).includes('blog:');

        const isStaticKeyInput = inputKey.slice(0, 10).includes('blog:');

        // TODO: Optimise this to only run diff if we find something in the checks.json
        const diff = isStaticKeyInput
          ? Diff.diffWordsWithSpace(oldMarkdownOriginal, markdownOriginal)
          : [];

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

        const locationString = generateLocationString(markdownOriginal, page);
        const joinedComment =
          diffStringAdded.length > 0 || diffStringRemoved.length > 0
            ? `${diffString} \n ${locationString}`
            : `${locationString}`;

        const formattedLabel =
          originalPhraseTidied.length > 42
            ? `${originalPhraseTidied.substring(0, 42)}...`
            : originalPhraseTidied;

        cleanedOutputFileData['_inputs'][inputKey] = {
          label: formattedLabel,
          hidden: originalPhrase === '' ? true : false,
          type: inputType,
          options: options,
          comment: joinedComment,
          context: {
            open: false,
            title: 'Untranslated Text',
            icon: 'translate',
            content: markdownOriginal,
          },
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
      });
      await fs.promises.writeFile(
        translationFilePath,
        YAML.stringify(cleanedOutputFileData)
      );
      console.log('✅✅ ' + translationFilePath + ' updated succesfully');
    })
  );
}

// Loop through locales
for (let i = 0; i < locales.length; i++) {
  const locale = locales[i];

  main(locale).catch((err) => {
    console.error(`❌❌ Encountered an error translating ${locale}:`, err);
  });
}

module.exports = { main };
