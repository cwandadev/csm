import { useState } from "react";

type Props = {
  normal: string;
  hover?: string;
  active?: string;
  size?: string;
  activeColor?: string;
  className?: string;
  onClick?: () => void;
};

export default function DynamicIcon({
  normal,
  hover,
  active,
  size = "text-lg",
  activeColor = "text-primary",
  className = "",
  onClick,
}: Props) {
  const [isActive, setIsActive] = useState(false);

  return (
    <i
      className={`bx ${size} cursor-pointer transition-all duration-200
        ${normal}
        ${hover ? `group-hover:${hover}` : ""}
        ${isActive ? `${active || hover || normal} ${activeColor}` : ""}
        ${className}
      `}
      onClick={() => {
        setIsActive(!isActive);
        onClick && onClick();
      }}
      aria-hidden="true"
    ></i>
  );
}