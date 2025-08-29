import "./styles.css";

export function MenuBar() {
  return (
    <div className="bg-white border-r border-gray-200 shadow-sm h-screen w-64 flex flex-col">
      {/* Logo/Brand */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">MailBox</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <a href="#" className="href-link">
          Inbox
        </a>
        <a href="#" className="href-link">
          Sent
        </a>
        <a href="#" className="href-link">
          Drafts
        </a>
        <a href="#" className="href-link">
          Archive
        </a>
      </nav>

      {/* Bottom actions */}
      <div className="px-4 py-4 space-y-4 border-t border-gray-200">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search emails..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Compose button */}
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-2">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>Compose</span>
        </button>

        {/* User menu */}
        <div className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">U</span>
          </div>
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
