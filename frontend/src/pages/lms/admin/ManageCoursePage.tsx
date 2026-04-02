import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRMSLayout from '../../../components/shared/HRMSLayout';
import Modal from '../../../components/shared/Modal';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import QuestionForm from '../../../components/lms/admin/QuestionForm';
import YouTubeEmbed from '../../../components/lms/shared/YouTubeEmbed';
import { getCourse } from '../../../api/lms-courses';
import { listQuestions, createQuestion, updateQuestion, deleteQuestion } from '../../../api/lms-questions';
import type { Course, Question } from '../../../types';

export default function ManageCoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const courseId = Number(id);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([getCourse(courseId), listQuestions(courseId)]);
      setCourse(c);
      setQuestions(q);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: Partial<Question>) => {
    await createQuestion(courseId, data);
    setShowForm(false);
    load();
  };

  const handleUpdate = async (data: Partial<Question>) => {
    if (!editing) return;
    await updateQuestion(courseId, editing.id, data);
    setEditing(null);
    setShowForm(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteQuestion(courseId, deleting.id);
    setDeleting(null);
    load();
  };

  if (loading) {
    return <HRMSLayout><p className="text-gray-500">Loading...</p></HRMSLayout>;
  }

  if (!course) {
    return <HRMSLayout><p className="text-gray-500">Course not found.</p></HRMSLayout>;
  }

  const OPTION_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

  return (
    <HRMSLayout>
      <button onClick={() => navigate('/lms/admin')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 inline-block">
        &larr; Back to Courses
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
      {course.description && <p className="text-gray-600 mb-6">{course.description}</p>}

      {course.youtube_url && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <YouTubeEmbed url={course.youtube_url} />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Quiz Questions ({questions.length})</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + Add Question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-gray-500">No questions yet. Add your first question!</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-indigo-600 mr-2">Q{i + 1}.</span>
                  {q.question_text}
                </p>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => {
                      setEditing(q);
                      setShowForm(true);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Edit
                  </button>
                  <button onClick={() => setDeleting(q)} className="text-sm text-red-600 hover:text-red-800 font-medium">
                    Delete
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                  const optKey = `option_${opt}` as keyof Question;
                  const isCorrect = q.correct_option === opt;
                  return (
                    <div
                      key={opt}
                      className={`px-3 py-2 rounded-lg text-sm ${isCorrect ? 'bg-green-50 border border-green-200 text-green-800 font-medium' : 'bg-gray-50 text-gray-600'}`}
                    >
                      <strong>{OPTION_LABELS[opt]}.</strong> {q[optKey] as string}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Question' : 'Add Question'}
      >
        <QuestionForm
          initial={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Question"
        message="Are you sure you want to delete this question?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </HRMSLayout>
  );
}
