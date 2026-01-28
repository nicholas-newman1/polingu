import { CircularProgress } from '@mui/material';
import { PageContainer, LoadingContainer } from './styles';

export function CustomItemLoadingState() {
  return (
    <PageContainer>
      <LoadingContainer>
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </LoadingContainer>
    </PageContainer>
  );
}
