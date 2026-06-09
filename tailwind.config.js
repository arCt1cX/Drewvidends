/** @type {import('tailwindcss').Config} */
// Drewvidend · "Quiet Premium" — neutri freddi + un solo accento smeraldo desaturato.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#14161b', // neutro freddo, niente blu-navy
        surface: '#1a1d23', // card
        surface2: '#22262e', // hover / segmenti attivi
        line: '#272b33', // bordi discreti
        muted: '#878d9a', // testo secondario
        ink: '#eceef2', // testo principale
        accent: '#37b88a', // smeraldo desaturato
        'accent-dim': 'rgba(55,184,138,0.13)',
        pos: '#37b88a', // positivo / dividendo
        danger: '#e0625a', // rosso desaturato
        warn: '#e0b250' // ambra desaturata (ex-date imminente)
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      borderRadius: {
        '2xl': '1.25rem' // 20px
      },
      letterSpacing: {
        tightish: '-0.02em'
      }
    }
  },
  plugins: []
}
