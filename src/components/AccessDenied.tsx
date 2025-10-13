import Navbar from './Navbar';
import { FaDiscord } from 'react-icons/fa';
import { Link } from 'react-router-dom';

interface AccessDeniedProps {
    message?: string;
    description?: string;
    sessionId?: string;
    accessId?: string;
    errorType?:
        | 'access-denied'
        | 'invalid-session'
        | 'banned'
        | 'tester-required'
        | 'pilot-not-found'
        | 'flight-not-found';
}

export default function AccessDenied({
    message,
    description,
    sessionId,
    accessId,
    errorType = 'access-denied',
}: AccessDeniedProps) {
    let displayMessage = message;
    let displayDescription = description;

    if (errorType === 'invalid-session') {
        displayMessage = displayMessage || 'Invalid Session';
        displayDescription =
            displayDescription ||
            'The session you are trying to access does not exist or is no longer available.';
    } else if (errorType === 'banned') {
        displayMessage = displayMessage || 'You are banned';
        displayDescription =
            displayDescription ||
            'Your account has been banned. Please contact support for more information.';
    } else if (errorType === 'tester-required') {
        displayMessage = displayMessage || 'Tester Access Required';
        displayDescription =
            displayDescription ||
            'This application is currently in testing. Please contact an administrator if you believe you should have access.';
    } else if (errorType === 'pilot-not-found') {
        displayMessage = displayMessage || 'Pilot Not Found';
        displayDescription =
            displayDescription ||
            'The pilot you are looking for could not be found.';
    } else if (errorType === 'flight-not-found') {
        displayMessage = displayMessage || 'Flight Not Found';
        displayDescription =
            displayDescription ||
            'The flight you are looking for could not be found or the link has expired.';
    } else {
        displayMessage = displayMessage || 'Access Denied';
        displayDescription =
            displayDescription ||
            "You don't have permission to access this session";
    }

    const bgGradient =
        errorType === 'invalid-session'
            ? 'from-black via-zinc-900 to-yellow-700'
            : errorType === 'banned'
              ? 'from-black via-zinc-900 to-red-900'
              : errorType === 'tester-required'
                ? 'from-black via-zinc-900 to-cyan-900'
                : errorType === 'pilot-not-found'
                  ? 'from-black via-zinc-900 to-blue-900'
                  : errorType === 'flight-not-found'
                    ? 'from-black via-zinc-900 to-blue-900'
                    : 'from-black via-zinc-900 to-red-950';
    const textGradient =
        errorType === 'invalid-session'
            ? 'from-yellow-400 to-yellow-700'
            : errorType === 'banned'
              ? 'from-red-400 to-red-700'
              : errorType === 'tester-required'
                ? 'from-cyan-400 to-cyan-700'
                : errorType === 'pilot-not-found'
                  ? 'from-blue-400 to-blue-700'
                  : errorType === 'flight-not-found'
                    ? 'from-blue-400 to-blue-700'
                    : 'from-red-400 to-red-900';

    return (
        <div
            className={`min-h-screen bg-gradient-to-b ${bgGradient} text-white flex flex-col`}
        >
            <Navbar sessionId={sessionId} accessId={accessId} />
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                    <h1
                        className={`text-[10rem] font-extrabold bg-gradient-to-br ${textGradient} bg-clip-text text-transparent -mb-8`}
                    >
                        {errorType === 'invalid-session' ||
                        errorType === 'pilot-not-found' ||
                        errorType === 'flight-not-found'
                            ? '404'
                            : '403'}
                    </h1>
                    <p className="text-2xl mb-4 text-gray-300">
                        {displayMessage}
                    </p>
                    <p className="text-lg mb-8 text-gray-400">
                        {displayDescription}
                    </p>
                    {errorType === 'tester-required' ||
                    errorType === 'pilot-not-found' ||
                    errorType === 'flight-not-found' ? (
                        <Link
                            to="https://pfconnect.online/discord"
                            className={`inline-flex items-center px-8 py-4 rounded-full ${'bg-[#4f62a5] hover:bg-[#45568f]'} text-white text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl`}
                        >
                            <FaDiscord className="mr-3 h-6 w-6 group-hover:-translate-x-1 transition-transform duration-300" />
                            Support Server
                        </Link>
                    ) : (
                        <Link
                            to="https://pfconnect.online/discord"
                            className={`inline-flex items-center px-8 py-4 rounded-full ${
                                errorType === 'invalid-session'
                                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800'
                                    : 'bg-[#b63030] hover:bg-[#8f3939]'
                            } text-white text-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl`}
                        >
                            <FaDiscord className="mr-3 h-6 w-6 group-hover:-translate-x-1 transition-transform duration-300" />
                            Support Server
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
