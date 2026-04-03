import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../../components/shared/AppLayout';
import Modal from '../../../components/shared/Modal';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import CourseForm from '../../../components/lms/admin/CourseForm';
import { listCourses, createCourse, updateCourse, deleteCourse } from '../../../api/lms-courses';
import type { Course } from '../../../types';

export default function LmsAdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCourses();
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: { title: string; description: string; youtube_url: string }) => {
    await createCourse(data);
    setShowCourseForm(false);
    load();
  };

  const handleUpdate = async (data: { title: string; description: string; youtube_url: string }) => {
    if (!editing) return;
    await updateCourse(editing.id, data);
    setEditing(null);
    setShowCourseForm(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteCourse(deleting.id);
    setDeleting(null);
    load();
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">LMS Admin Dashboard</h1>
        <p className="text-gray-500">Manage courses</p>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => {
            setEditing(null);
            setShowCourseForm(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + Add Course
        </button>
        <button
          onClick={() => navigate('/lms/admin/reports')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          View Reports
        </button>
        <button
          onClick={() => navigate('/lms')}
          className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
        >
          My Learning
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : courses.length === 0 ? (
        <p className="text-gray-500">No courses yet. Create your first course!</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Title', 'Description', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <button
                      onClick={() => navigate(`/lms/admin/courses/${c.id}`)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {c.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{c.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setShowCourseForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showCourseForm}
        onClose={() => {
          setShowCourseForm(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Course' : 'Add Course'}
      >
        <CourseForm
          initial={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowCourseForm(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleting?.title}"? This will also delete all questions and student attempts.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </AppLayout>
  );
}
