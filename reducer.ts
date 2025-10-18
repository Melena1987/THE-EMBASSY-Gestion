import type { Bookings, ShiftAssignments, BookingDetails, ShiftAssignment } from './types';

export interface AppState {
    bookings: Bookings;
    shiftAssignments: ShiftAssignments;
}

type AddBookingAction = {
    type: 'ADD_BOOKING';
    payload: {
        keys: string[];
        details: BookingDetails;
    };
};

type DeleteBookingAction = {
    type: 'DELETE_BOOKING';
    payload: {
        keys: string[];
    };
};

type UpdateShiftsAction = {
    type: 'UPDATE_SHIFTS';
    payload: {
        weekId: string;
        shifts: ShiftAssignment;
    };
};

type ResetWeekShiftsAction = {
    type: 'RESET_WEEK_SHIFTS';
    payload: {
        weekId: string;
    };
};

export type AppAction = AddBookingAction | DeleteBookingAction | UpdateShiftsAction | ResetWeekShiftsAction;

export const initialState: AppState = {
    bookings: {},
    shiftAssignments: {},
};

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'ADD_BOOKING': {
            const newBookings = { ...state.bookings };
            action.payload.keys.forEach(key => {
                newBookings[key] = action.payload.details;
            });
            return {
                ...state,
                bookings: newBookings,
            };
        }

        case 'DELETE_BOOKING': {
            const newBookings = { ...state.bookings };
            action.payload.keys.forEach(key => {
                delete newBookings[key];
            });
            return {
                ...state,
                bookings: newBookings,
            };
        }

        case 'UPDATE_SHIFTS': {
            return {
                ...state,
                shiftAssignments: {
                    ...state.shiftAssignments,
                    [action.payload.weekId]: action.payload.shifts,
                },
            };
        }

        case 'RESET_WEEK_SHIFTS': {
            const newAssignments = { ...state.shiftAssignments };
            delete newAssignments[action.payload.weekId];
            return {
                ...state,
                shiftAssignments: newAssignments,
            };
        }

        default:
            return state;
    }
}
