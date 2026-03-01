import React, { useState, useRef, useEffect } from 'react';
import { Camera, Sparkles, Trash2, ThumbsDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Toast } from '../components/ui/toast';
import { useSchoolMenu, useDeleteSchoolMenuItem, useParseMenuPhoto, useAddMenuFeedback } from '../hooks/useSchoolMenu';
import { format, parseISO, isPast, startOfDay } from 'date-fns';

const SchoolMenuPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info' | 'warning'; message: string; description?: string }>({ show: false, type: 'info', message: '' });

  const { data: menuItems, isLoading, isError, refetch } = useSchoolMenu();
  const deleteMenuItem = useDeleteSchoolMenuItem();
  const parsePhoto = useParseMenuPhoto();
  const addFeedback = useAddMenuFeedback();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous messages
    setParseError(null);
    setParseSuccess(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Safe extraction of image MIME type from data URI with fallback
  const extractImageType = (dataUri: string): string => {
    const match = dataUri.match(/^data:([^;]+)/);
    return match?.[1] || 'image/jpeg';
  };

  const handleParsePhoto = async () => {
    if (!selectedImage) return;

    setParsing(true);
    setParseError(null);
    setParseSuccess(null);

    try {
      const imageType = extractImageType(selectedImage);
      const result = await parsePhoto.mutateAsync({
        imageData: selectedImage,
        imageType,
        autoAdd: true,
      });

      // Success! Refresh the menu list
      await refetch();

      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Show success message
      const count = result?.data?.added_count || result?.data?.count || 0;
      setParseSuccess(`Successfully added ${count} menu item${count !== 1 ? 's' : ''}!`);

      // Clear success message after 5 seconds
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => setParseSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to parse menu photo:', err);
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to parse menu photo. Please try again.';
      setParseError(errorMessage);
    } finally {
      setParsing(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMenuItem.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      setToast({ show: true, type: 'error', message: 'Failed to delete', description: 'Could not delete the menu item. Please try again.' });
    }
  };

  const handleDislike = async (menuItemId: number) => {
    try {
      await addFeedback.mutateAsync({
        menuItemId,
        feedbackType: 'disliked',
      });
    } catch (error) {
      console.error('Failed to record feedback:', error);
      setToast({ show: true, type: 'error', message: 'Failed to save feedback', description: 'Could not record your dislike. Please try again.' });
    }
  };

  // Group menu items by date
  const menuByDate = menuItems?.reduce((acc, item) => {
    if (!acc[item.menu_date]) {
      acc[item.menu_date] = [];
    }
    acc[item.menu_date].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>) || {};

  const sortedDates = Object.keys(menuByDate).sort();

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">School Menu</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Upload photos of school menus and track what your kids like
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Photo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload Menu Photo
          </CardTitle>
          <CardDescription>
            Take a photo of the school menu or upload an image
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Success Message */}
          {parseSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {parseSuccess}
            </div>
          )}

          {/* Error Message */}
          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <strong>Error:</strong> {parseError}
            </div>
          )}

          {!selectedImage ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 min-h-[44px]"
              variant="outline"
            >
              <Camera className="mr-2 h-5 w-5" />
              Take/Upload Photo
            </Button>
          ) : (
            <div className="space-y-4">
              <img
                src={selectedImage}
                alt="Selected menu"
                className="w-full max-h-96 object-contain rounded-lg border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleParsePhoto}
                  disabled={parsing}
                  className="flex-1"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {parsing ? 'Parsing with AI... (this may take 10-30 seconds)' : 'Parse Menu with AI'}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedImage(null);
                    setParseError(null);
                    setParseSuccess(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  variant="outline"
                  disabled={parsing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Menu Items */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading menu items...
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-destructive">
          <p className="text-lg font-medium mb-2">Failed to load menu items</p>
          <p className="text-sm">Please try refreshing the page. If the problem persists, check your internet connection.</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No menu items yet</p>
            <p className="text-sm">
              Upload a photo of the school menu to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => {
            const items = menuByDate[date] ?? [];
            const dateObj = parseISO(date);
            const isPastDate = isPast(startOfDay(dateObj));

            return (
              <Card key={date} className={isPastDate ? 'opacity-60' : ''}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {format(dateObj, 'EEEE, MMMM d, yyyy')}
                    {isPastDate && <span className="ml-2 text-sm text-muted-foreground">(Past)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 rounded-md border border-border bg-card"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.meal_name}</h4>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize">
                              {item.meal_type}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 min-h-[36px]"
                            onClick={() => handleDislike(item.id)}
                            aria-label={`Dislike ${item.meal_name}`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 min-h-[36px]"
                            onClick={() => handleDelete(item.id)}
                            aria-label={`Delete ${item.meal_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info */}
      <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 text-base">
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            1. Take a photo of your school's monthly cafeteria menu
          </p>
          <p>
            2. Our AI will automatically extract all the meals and dates
          </p>
          <p>
            3. Mark meals your kids don't like so the meal planner can suggest alternatives
          </p>
          <p>
            4. The system will help you plan backup lunches for days when kids won't eat school lunch
          </p>
        </CardContent>
      </Card>

      {/* Toast notification */}
      {toast.show && (
        <Toast
          type={toast.type}
          message={toast.message}
          description={toast.description}
          duration={5000}
          onDismiss={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
};

export default SchoolMenuPage;
