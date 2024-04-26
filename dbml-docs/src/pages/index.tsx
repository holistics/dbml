import { useHistory } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { useEffect } from 'react';

function Home() {
  const { siteConfig } = useDocusaurusContext();
  const history = useHistory();

  useEffect(() => {
    history.push('/home');
  }, []);

  return <Layout title={`${siteConfig.title}`} />;
}

export default Home;
