import StyleDictionary from 'style-dictionary';

// Emit a nested TS object (tokens.color.bg.base) rather than flat consts, so
// the Tailwind config and components can spread whole groups.
StyleDictionary.registerFormat({
  name: 'ts/nested',
  format: ({ dictionary }) => {
    const tree = {};
    for (const t of dictionary.allTokens) {
      let node = tree;
      for (const key of t.path.slice(0, -1)) node = node[key] ??= {};
      node[t.path.at(-1)] = t.value;
    }
    return (
      '// AUTO-GENERATED from src/tokens/tokens.json — do not edit by hand.\n' +
      `const tokens = ${JSON.stringify(tree, null, 2)} as const;\n\n` +
      'export default tokens;\n' +
      'export type Tokens = typeof tokens;\n'
    );
  },
});

const sd = new StyleDictionary({
  source: ['src/tokens/tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'aura',
      buildPath: 'src/tokens/generated/',
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'src/tokens/generated/',
      files: [{ destination: 'tokens.ts', format: 'ts/nested' }],
    },
  },
});

await sd.buildAllPlatforms();
