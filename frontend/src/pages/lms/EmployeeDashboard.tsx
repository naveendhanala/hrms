import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/shared/AppLayout';
import { listCourses } from '../../api/lms-courses';
import type { Course } from '../../types';

export default function EmployeeDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listCourses()
      .then(setCourses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completed = courses.filter((c) => c.attempt?.submitted_at).length;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Courses</h1>
        <p className="text-gray-500">
          Learning Management System
          {courses.length > 0 && ` - ${completed}/${courses.length} completed`}
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading courses...</p>
      ) : courses.length === 0 ? (
        <p className="text-gray-500">No courses available yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const attempt = course.attempt;
            const isWatched = attempt?.watched === 1;
            const isCompleted = !!attempt?.submitted_at;

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/lms/courses/${course.id}/watch`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                    {isCompleted ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 shrink-0 ml-2">Completed</span>
                    ) : isWatched ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 shrink-0 ml-2">Watched</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 shrink-0 ml-2">Not Started</span>
                    )}
                  </div>
                  {course.description && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">{course.description}</p>
                  )}
                  {isCompleted && attempt && (
                    <p className="text-sm text-gray-500">
                      Score: {attempt.score}/{attempt.total}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
