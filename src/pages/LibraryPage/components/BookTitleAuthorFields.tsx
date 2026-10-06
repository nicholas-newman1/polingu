import { TextField } from '@mui/material';

interface BookTitleAuthorFieldsProps {
  title: string;
  author: string;
  onTitleChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  titlePlaceholder?: string;
}

export function BookTitleAuthorFields({
  title,
  author,
  onTitleChange,
  onAuthorChange,
  titlePlaceholder,
}: BookTitleAuthorFieldsProps) {
  return (
    <>
      <TextField
        autoFocus
        fullWidth
        label="Title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={titlePlaceholder}
      />
      <TextField
        fullWidth
        label="Author"
        value={author}
        onChange={(e) => onAuthorChange(e.target.value)}
      />
    </>
  );
}
