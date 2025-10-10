import React, { useState, useEffect, useCallback } from 'react';
import {
	fetchAirports,
	fetchAircrafts,
	fetchAirlines,
	fetchFrequencies
} from '../../utils/fetch/data';
import type { Airport, AirportFrequency } from '../../types/airports';
import type { Aircraft } from '../../types/aircraft';
import type { Airline } from '../../types/airlines';
import { DataContext } from './useData';

export function DataProvider({ children }: { children: React.ReactNode }) {
	const [airports, setAirports] = useState<Airport[]>([]);
	const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
	const [airlines, setAirlines] = useState<Airline[]>([]);
	const [frequencies, setFrequencies] = useState<AirportFrequency[]>([]);
	const [airportRunways, setAirportRunways] = useState<
		Record<string, string[]>
	>({});
	const [airportSids, setAirportSids] = useState<Record<string, string[]>>(
		{}
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [fetchedAirports, setFetchedAirports] = useState<Set<string>>(
		new Set()
	);

	const fetchAirportData = useCallback(async (icao: string) => {
		if (!icao) return;

		setFetchedAirports((currentFetched) => {
			if (currentFetched.has(icao)) {
				return currentFetched;
			}

			const newFetched = new Set([...currentFetched, icao]);

			(async () => {
				try {
					const [runwaysData, sidsData] = await Promise.all([
						fetch(
							`${
								import.meta.env.VITE_SERVER_URL
							}/api/data/airports/${icao}/runways`
						)
							.then((res) => (res.ok ? res.json() : []))
							.catch(() => []),
						fetch(
							`${
								import.meta.env.VITE_SERVER_URL
							}/api/data/airports/${icao}/sids`
						)
							.then((res) => (res.ok ? res.json() : []))
							.catch(() => [])
					]);

					setAirportRunways((prev) => ({
						...prev,
						[icao]: Array.isArray(runwaysData) ? runwaysData : []
					}));
					setAirportSids((prev) => ({
						...prev,
						[icao]: Array.isArray(sidsData) ? sidsData : []
					}));
				} catch (err) {
					console.error(
						`Error fetching data for airport ${icao}:`,
						err
					);
					setAirportRunways((prev) => ({ ...prev, [icao]: [] }));
					setAirportSids((prev) => ({ ...prev, [icao]: [] }));
				}
			})();

			return newFetched;
		});
	}, []);

	useEffect(() => {
		async function loadStaticData() {
			try {
				const [airportsData, aircraftsData, airlinesData, frequenciesData] =
					await Promise.all([
						fetchAirports().catch((err) => {
							console.error('Failed to fetch airports:', err);
							return [];
						}),
						fetchAircrafts().catch((err) => {
							console.error('Failed to fetch aircrafts:', err);
							return [];
						}),
						fetchAirlines().catch((err) => {
							console.error('Failed to fetch airlines:', err);
							return [];
						}),
						fetchFrequencies().catch((err) => {
							console.error('Failed to fetch frequencies:', err);
							return [];
						})
					]);

				setAirports(Array.isArray(airportsData) ? airportsData : []);
				setAircrafts(Array.isArray(aircraftsData) ? aircraftsData : []);
				setAirlines(Array.isArray(airlinesData) ? airlinesData : []);
				setFrequencies(
					Array.isArray(frequenciesData) ? frequenciesData : []
				);
			} catch (err) {
				setError('Failed to load data');
				console.error('Error loading static data:', err);
				setAirports([]);
				setAircrafts([]);
				setAirlines([]);
				setFrequencies([]);
			} finally {
				setLoading(false);
			}
		}

		loadStaticData();
	}, []);

	return (
		<DataContext.Provider
			value={{
				airports,
				aircrafts,
				airlines,
				frequencies,
				airportRunways,
				airportSids,
				loading,
				error,
				fetchAirportData,
				fetchedAirports
			}}
		>
			{children}
		</DataContext.Provider>
	);
}
