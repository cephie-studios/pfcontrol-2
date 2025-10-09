import type { Flight } from './fetch/logbook.ts';
import type { JSX } from 'react';
import { Check } from 'lucide-react';

export const getStatusBadge = (flight: Flight) => {
    const status = flight.flight_status;
    const controllerStatus = flight.controller_status?.toLowerCase();
    const currentPhase = flight.current_phase?.toLowerCase();
    let displayText: string | JSX.Element;
    let bgColor: string;
    let borderColor: string;
    let textColor: string;

    if (status === 'completed') {
        displayText = (
            <span className="flex items-center">
                <Check className="w-3 h-3 mr-1" />
                Completed
            </span>
        );
    } else if (controllerStatus) {
        const isArrivalPhase =
            [
                'depa',
                'departure',
                'cruise',
                'appr',
                'approach',
                'gate',
            ].includes(controllerStatus.toLowerCase()) || status === 'active';

        switch (controllerStatus.toLowerCase()) {
            case 'pending':
                displayText = 'Pending';
                break;
            case 'stup':
                displayText = 'Push & Start';
                break;
            case 'push':
                displayText = 'Push & Start';
                break;
            case 'origin_taxi':
                displayText = 'Origin Taxi';
                break;
            case 'destination_taxi':
                displayText = 'Destination Taxi';
                break;
            case 'taxi':
                displayText = isArrivalPhase
                    ? 'Destination Taxi'
                    : 'Origin Taxi';
                break;
            case 'origin_runway':
                displayText = 'Origin Runway';
                break;
            case 'destination_runway':
                displayText = 'Destination Runway';
                break;
            case 'rwy':
            case 'runway':
                displayText = isArrivalPhase
                    ? 'Destination Runway'
                    : 'Origin Runway';
                break;
            case 'depa':
            case 'departure':
                displayText = 'Climbing';
                break;
            case 'cruise':
                displayText = 'Cruising';
                break;
            case 'appr':
            case 'approach':
                displayText = 'Approach';
                break;
            case 'gate':
                displayText = 'Destination Gate';
                break;
            case 'climb':
                displayText = 'Climbing';
                break;
            case 'descent':
                displayText = 'Descending';
                break;
            case 'landing':
                displayText = 'Landing';
                break;
            case 'parked':
                displayText = 'Parked';
                break;
            default:
                displayText =
                    controllerStatus.charAt(0).toUpperCase() +
                    controllerStatus.slice(1);
        }
    } else if (status === 'active' && currentPhase) {
        switch (currentPhase) {
            case 'origin_taxi':
                displayText = 'Origin Taxi';
                break;
            case 'destination_taxi':
                displayText = 'Destination Taxi';
                break;
            case 'taxi':
                displayText = 'Taxiing';
                break;
            case 'takeoff':
                displayText = 'Taking Off';
                break;
            case 'climb':
                displayText = 'Climbing';
                break;
            case 'cruise':
                displayText = 'Cruising';
                break;
            case 'descent':
                displayText = 'Descending';
                break;
            case 'approach':
                displayText = 'Approach';
                break;
            case 'landing':
                displayText = 'Landing';
                break;
            case 'parked':
                displayText = 'Parked';
                break;
            case 'push':
                displayText = 'Push & Start';
                break;
            case 'origin_runway':
                displayText = 'Origin Runway';
                break;
            case 'destination_runway':
                displayText = 'Destination Runway';
                break;
            case 'runway':
            case 'rwy':
                displayText = 'On Runway';
                break;
            default:
                displayText = 'In Flight';
        }
    } else if (status === 'pending') {
        displayText = 'Pending';
    } else if (status === 'active') {
        displayText = 'In Flight';
    } else {
        displayText = status;
    }

    switch (status) {
        case 'pending':
            bgColor = 'bg-yellow-900/30';
            borderColor = 'border-yellow-700';
            textColor = 'text-yellow-300';
            break;
        case 'active':
            bgColor = 'bg-green-900/30';
            borderColor = 'border-green-700';
            textColor = 'text-green-300';
            break;
        case 'completed':
            bgColor = 'bg-blue-900/30';
            borderColor = 'border-blue-700';
            textColor = 'text-blue-300';
            break;
        default:
            bgColor = 'bg-gray-900/30';
            borderColor = 'border-gray-700';
            textColor = 'text-gray-300';
    }

    return {
        text: displayText,
        bgColor,
        borderColor,
        textColor,
    };
};
