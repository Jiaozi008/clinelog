import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  onRatingChange,
  readonly = false,
  size = 20
}) => {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  const handleMouseEnter = (index: number) => {
    if (!readonly) setHoverRating(index);
  };

  const handleMouseLeave = () => {
    if (!readonly) setHoverRating(null);
  };

  const handleClick = (index: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(index);
    }
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: maxRating }).map((_, i) => {
        const starIndex = i + 1;
        const isFilled = (hoverRating !== null ? starIndex <= hoverRating : starIndex <= rating);
        
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(starIndex)}
            onMouseEnter={() => handleMouseEnter(starIndex)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-transform hover:scale-110 focus:outline-none`}
          >
            <Star
              size={size}
              className={`${isFilled ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`}
              strokeWidth={isFilled ? 0 : 1.5}
            />
          </button>
        );
      })}
    </div>
  );
};