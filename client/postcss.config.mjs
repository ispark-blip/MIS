export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      features: {
        'cascade-layers': true,
        'oklab-function': true,
      },
    },
  },
};
