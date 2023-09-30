import {useState} from 'react';
import styled from '@emotion/styled';
import {css} from '@linaria/core';
import {styled as lstyled} from '@linaria/react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme, {Theme} from 'sentry/utils/theme';
import {withTheme} from 'sentry/utils/theming';

const makeKey = (prefix: string) => `${prefix}-banner-dismissed`;

function dismissBanner(bannerKey: string) {
  localStorage.setItem(makeKey(bannerKey), 'true');
}

function useDismissable(bannerKey: string) {
  const key = makeKey(bannerKey);
  const [value, setValue] = useState(localStorage.getItem(key));

  const dismiss = () => {
    setValue('true');
    dismissBanner(bannerKey);
  };

  return [value === 'true', dismiss] as const;
}

type BannerWrapperProps = {
  theme: Theme;
  backgroundComponent?: React.ReactNode;
  backgroundImg?: string;
};

type Props = BannerWrapperProps & {
  children?: React.ReactNode;
  className?: string;
  dismissKey?: string;
  isDismissable?: boolean;
  subtitle?: string;
  title?: string;
};

function Banner({
  title,
  subtitle,
  isDismissable = true,
  dismissKey = 'generic-banner',
  className,
  backgroundImg,
  backgroundComponent,
  children,
}: Props) {
  const [dismissed, dismiss] = useDismissable(dismissKey);

  if (dismissed) {
    return null;
  }

  return (
    <BannerWrapper backgroundImg={backgroundImg} className={className}>
      {backgroundComponent}
      {isDismissable ? <CloseButton onClick={dismiss} aria-label={t('Close')} /> : null}
      <BannerContent>
        <BannerTitle>{title}</BannerTitle>
        <BannerSubtitle>{subtitle}</BannerSubtitle>
        <StyledButtonBar gap={1}>{children}</StyledButtonBar>
      </BannerContent>
    </BannerWrapper>
  );
}

Banner.dismiss = dismissBanner;

const BannerWrapper = withTheme(lstyled.div<BannerWrapperProps>`
  ${p =>
    p.backgroundImg
      ? css`
          background: url(${p.backgroundImg});
          background-repeat: no-repeat;
          background-size: cover;
          background-position: center center;
        `
      : css`
          background-color: ${p.theme.gray500};
        `}
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: ${space(2)};
  box-shadow: ${p => p.theme.dropShadowMedium};
  border-radius: ${p => p.theme.borderRadius};
  height: 180px;
  color: ${p => p.theme.white};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    height: 220px;
  }
`);

const BannerContent = lstyled.div`
  position: absolute;
  display: grid;
  justify-items: center;
  grid-template-rows: repeat(3, max-content);
  text-align: center;
  padding: ${space(4)};
`;

const BannerTitle = lstyled.h1`
  margin: 0;

  @media (min-width: ${theme.breakpoints.small}) {
    font-size: 40px;
  }
`;

const BannerSubtitle = lstyled.div`
  margin: 0;

  @media (min-width: ${theme.breakpoints.small}) {
    font-size: ${theme.fontSizeExtraLarge};
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  width: fit-content;
`;

const CloseButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

CloseButton.defaultProps = {
  icon: <IconClose />,
  ['aria-label']: t('Close'),
  priority: 'link',
  borderless: true,
  size: 'xs',
};

export default Banner;
