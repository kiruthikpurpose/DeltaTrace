import { Link } from 'react-router-dom';
import { PageHeader } from '../components/shell/PageHeader';

export default function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Page not found" purpose="That route does not exist in DeltaTrace Live." />
      <p>
        <Link className="btn primary" to="/">Back to Overview</Link>
      </p>
    </div>
  );
}
