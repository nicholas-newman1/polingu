import { styled as muiStyled } from '@mui/material/styles';

type StyledComponent = typeof muiStyled;

const shouldForwardProp = (prop: string) => !prop.startsWith('$');

export const styled: StyledComponent = ((
  component: Parameters<StyledComponent>[0],
  options?: Parameters<StyledComponent>[1]
) => {
  return muiStyled(component, {
    shouldForwardProp,
    ...options,
  });
}) as StyledComponent;
