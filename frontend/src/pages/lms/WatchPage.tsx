import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRMSLayout from '../../components/shared/HRMSLayout';
import YouTubeEmbed from '../../components/lms/shared/YouTubeEmbed';
import { getCourse } from '../../api/lms-courses';
import { markWatched, getAttempt } from '../../api/lms-attempts';
import type { Course, Attempt } from '../../types';

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getCourse(Number(id)),
      getAttempt(Number(id)),
    ])
      .then(([c, a]) => {
        setCourse(c);
        setAttempt(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleMarkWatched = async () => {
    if (!id) return;
    setMarking(true);
    try {
      const a = await markWatched(Number(id));
      setAttempt(a);
    } catch (err) {
      console.error(err);
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <HRMSLayout>
        <p className="text-gray-500">Loading...</p>
      </HRMSLayout>
    );
  }

  if (!course) {
    return (
      <HRMSLayout>
        <p className="text-gray-500">Course not found.</p>
      </HRMSLayout>
    );
  }

  const isWatched = attempt?.watched === 1;
  const isCompleted = !!attempt?.submitted_at;

  return (
    <HRMSLayout>
      <button onClick={() => navigate('/lms')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 inline-block">
        &larr; Back to Courses
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
      {course.description && <p className="text-gray-600 mb-6">{course.description}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <YouTubeEmbed url={course.youtube_url} />
      </div>

      <div className="flex gap-4">
        {!isWatched && (
          <button
            onClick={handleMarkWatched}
            disabled={marking}
            className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {marking ? 'Marking...' : 'Mark as Watched'}
          </button>
        )}

        {isWatched && !isCompleted && (
          <button
            onClick={() => navigate(`/lms/courses/${id}/quiz`)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Take Quiz
          </button>
        )}

        {isCompleted && attempt && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">
              Quiz completed! Score: {attempt.score}/{attempt.total}
              {' '}({attempt.total ? Math.round((attempt.score! / attempt.total) * 100) : 0}%)
            </p>
          </div>
        )}

        {isWatched && !isCompleted && (
          <span className="inline-flex items-center px-3 py-1 text-sm text-blue-700 bg-blue-50 rounded-lg">
            Video watched
          </span>
        )}
      </div>
    </HRMSLayout>
  );
}
