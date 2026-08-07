// Tab-bar icons exported from the PawPal Figma (node 20:5061).
// Each renders a single path filled with `currentColor` so the nav's colour
// (light default, yellow when active) drives the icon.

type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  width: "100%",
  height: "100%",
  fill: "none" as const,
  xmlns: "http://www.w3.org/2000/svg",
};

export function TodayIcon(props: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 28 29" {...base} {...props}>
      <path
        d="M13.9713 24.8822C19.6535 24.8822 24.2452 20.255 24.2452 14.5289L18.6778 14.5289C18.6778 17.1317 16.5541 19.2717 13.9713 19.2717C11.3885 19.2717 9.26482 17.1317 9.26482 14.5289C9.26482 11.9261 11.3885 9.78609 13.9713 9.78609V4.11784C8.28909 4.11784 3.6974 8.74499 3.6974 14.4711C3.6974 20.1972 8.34648 24.8822 13.9713 24.8822Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WalksIcon(props: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 28 28" {...base} {...props}>
      <path
        d="M20 4.00006V19.3333C20 19.701 19.7009 20 19.3333 20C18.9656 20 18.6666 19.701 18.6666 19.3333V8.66667C18.6666 6.09348 16.5732 4 14 4C11.4267 4 9.3333 6.09348 9.3333 8.66667V19.3333C9.3333 19.701 9.03425 20 8.66661 20C8.29898 20 7.99999 19.701 7.99999 19.3333V4.00006H4V19.3333C4 21.9066 6.09349 24 8.66667 24C11.2399 24 13.3333 21.9066 13.3333 19.3333V8.66667C13.3333 8.2991 13.6324 8.00005 14 8.00005C14.3675 8.00005 14.6667 8.2991 14.6667 8.66667V19.3333C14.6667 21.9066 16.7601 24 19.3333 24C21.9066 24 24 21.9066 24 19.3333V4.00006H20Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MealsIcon(props: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 28 28" {...base} {...props}>
      <path
        d="M23.0866 19.1812C22.0566 21.1255 20.4142 22.6758 18.4138 23.5919C16.4133 24.508 14.1666 24.7389 12.0217 24.2486C9.87678 23.7583 7.95344 22.5743 6.54968 20.8801C5.14592 19.1858 4.34012 17.0759 4.25712 14.8772C4.17412 12.6786 4.81856 10.5139 6.09059 8.71865C7.36262 6.92339 9.19122 5.59777 11.2931 4.94717C13.3949 4.29658 15.6526 4.35734 17.7164 5.12003C19.7802 5.88273 21.5349 7.30479 22.7085 9.16586L14.25 14.5L23.0866 19.1812Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function VetIcon(props: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 28 28" {...base} {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 25H16.7485V18.64C16.7485 17.74 17.5088 16.96 18.386 16.96H21.4854V11.5V11.2H24L21.0175 4H15.2865H14.4094H4V8.86V25Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ProfileIcon(props: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 28 28" {...base} {...props}>
      <path
        d="M10.1746 13.9721C10.1746 11.7941 11.9058 10.0629 14.0838 10.0629C16.2617 10.0629 17.9929 11.7941 17.9929 13.9721C17.9929 15.0331 17.5462 16.0383 16.8202 16.7085L24.0242 23.9125V4.03169H4.14338V23.9125L11.3474 16.7085C10.6214 16.0383 10.1746 15.0331 10.1746 13.9721Z"
        fill="currentColor"
      />
    </svg>
  );
}
