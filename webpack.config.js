const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/index.ts'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    publicPath: ''
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/types': path.resolve(__dirname, 'src/types'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/core': path.resolve(__dirname, 'src/core'),
      '@/content': path.resolve(__dirname, 'src/content'),
      '@/background': path.resolve(__dirname, 'src/background'),
      '@/popup': path.resolve(__dirname, 'src/popup')
    }
  },
  
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'popup.html', to: 'popup.html' },
        { from: 'manifest.json', to: 'manifest.json' }
      ]
    })
  ],
  
  optimization: {
    splitChunks: false,
    minimize: false
  },
  
  // Disable dynamic imports and code splitting for Chrome extension
  experiments: {
    outputModule: false
  }
};