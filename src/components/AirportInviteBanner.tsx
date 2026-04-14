interface AirportInviteBannerProps {
  href: string
  imageSrc: string
  title: string
}

export default function AirportInviteBanner({ href, imageSrc, title }: AirportInviteBannerProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full"
      title={title}
    >
      <img
        src={imageSrc}
        alt={title}
        loading="lazy"
        className="block w-full h-auto rounded-xl shadow-lg shadow-slate-900/10"
      />
    </a>
  )
}
