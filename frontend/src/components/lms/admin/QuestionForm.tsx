import { useState, useEffect } from 'react';
import type { Question } from '../../../types';

interface Props {
  initial?: Question | null;
  onSubmit: (data: Partial<Question>) => Promise<void>;
  onCancel: () => void;
}

export default function QuestionForm({ initial, onSubmit, onCancel }: Props) {
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setQuestionText(initial.question_text);
      setOptionA(initial.option_a);
      setOptionB(initial.option_b);
      setOptionC(initial.option_c);
      setOptionD(initial.option_d);
      setCorrectOption(initial.correct_option ?? 'a');
    } else {
      setQuestionText('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setCorrectOption('a');
    }
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correctOption,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Option A</label>
          <input value={optionA} onChange={(e) => setOptionA(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Option B</label>
          <input value={optionB} onChange={(e) => setOptionB(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Option C</label>
          <input value={optionC} onChange={(e) => setOptionC(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Option D</label>
          <input value={optionD} onChange={(e) => setOptionD(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Correct Option</label>
        <select value={correctOption} onChange={(e) => setCorrectOption(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
          <option value="d">D</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : initial ? 'Update Question' : 'Add Question'}
        </button>
      </div>
    </form>
  );
}
