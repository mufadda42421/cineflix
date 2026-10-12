import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailsViewContent } from '../components/DetailsModal';

export const TitleDetailsPage: React.FC = () => {
  const { mediaType, id } = useParams<{ mediaType: string; id: string }>();
  const navigate = useNavigate();

  const normalizedType: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
  const numericId = Number(id);

  if (!numericId || Number.isNaN(numericId)) {
    return (
      <main className="pt-28 pb-16 max-w-3xl mx-auto px-6 text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Invalid Title Link</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg bg-[#E50914] text-white text-xs font-semibold cursor-pointer"
        >
          Back to Home
        </button>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6 md:px-12">
      <DetailsViewContent
        mediaId={numericId}
        mediaType={normalizedType}
        onClose={() => navigate(-1)}
        isPage
      />
    </main>
  );
};
