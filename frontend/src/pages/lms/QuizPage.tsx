import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HRMSLayout from '../../components/shared/HRMSLayout';
import { getQuiz, submitQuiz } from '../../api/lms-attempts';
import type { Question } from '../../types';

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    getQuiz(Number(id))
      .then(setQuestions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAnswer = (questionId: number, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await submitQuiz(Number(id), answers);
      setResult({ score: res.score, total: res.total });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <HRMSLayout><p className="text-gray-500">Loading quiz...</p></HRMSLayout>;
  }

  if (result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const passed = pct >= 70;

    return (
      <HRMSLayout>
        <div className="max-w-lg mx-auto text-center py-12">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{passed ? 'Congratulations!' : 'Keep Learning!'}</h2>
          <p className="text-gray-600 mb-2">
            You scored {result.score} out of {result.total}
          </p>
          <p className={`text-sm font-medium mb-8 ${passed ? 'text-green-600' : 'text-red-600'}`}>
            {passed ? 'You passed the quiz!' : 'You need 70% to pass. Review the material and try again.'}
          </p>
          <button
            onClick={() => navigate('/lms')}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Back to Courses
          </button>
        </div>
      </HRMSLayout>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <HRMSLayout>
      <button onClick={() => navigate(`/lms/courses/${id}/watch`)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 inline-block">
        &larr; Back to Course
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quiz</h1>
        <span className="text-sm text-gray-500">{answeredCount}/{questions.length} answered</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all"
          style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
        />
      </div>

      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-900 mb-4">
              <span className="text-indigo-600 mr-2">Q{i + 1}.</span>
              {q.question_text}
            </p>
            <div className="space-y-2">
              {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                const optionKey = `option_${opt}` as keyof Question;
                const isSelected = answers[q.id] === opt;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt}
                      checked={isSelected}
                      onChange={() => handleAnswer(q.id, opt)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      <strong className="uppercase mr-1">{opt}.</strong>
                      {q[optionKey] as string}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || answeredCount < questions.length}
          className="px-8 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>
    </HRMSLayout>
  );
}
