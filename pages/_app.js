import '../styles/globals.css';
import NoSSR from 'react-no-ssr';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
