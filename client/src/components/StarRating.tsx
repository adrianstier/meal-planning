import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onChange,
  readonly = false,
  size = 'md',
  showNumber = false,
}) => {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleClick = (index: number) => {
    if (!readonly && onChange) {
      // If clicking the same rating, set to 0 (clear rating)
      onChange(rating === index + 1 ? 0 : index + 1);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((index) => (
        <button
          key={index}
          type="button"
          onClick={() => handleClick(index)}
          disabled={readonly}
          className={`${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
          } focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-400 rounded`}
          aria-label={`Rate ${index + 1} stars`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              index < rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      {showNumber && rating > 0 && (
        <span className="ml-1 text-sm text-muted-foreground">
          ({rating}/5)
        </span>
      )}
    </div>
  );
};

export default StarRating;
