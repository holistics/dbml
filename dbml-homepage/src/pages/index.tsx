import { Redirect } from '@docusaurus/router';

// Same issue: https://stackoverflow.com/questions/58665817/redirect-to-docs-from-landing-page-in-docusaurus-v2
// Redirect docs: https://docusaurus.io/docs/docusaurus-core#redirect
function Home() {
  return <Redirect to={'./home'} />
}

export default Home;
