/**
 * Featured filmmakers shown in the homepage portrait rotation, with their TMDB profile paths
 * resolved ahead of time (via the search-people function, Oct 2026) so visitors don't trigger
 * 40 lookups on every page load. If a photo ever 404s, re-resolve by name with search-people.
 */
export type FeaturedPortrait = { name: string; profile_path: string };

export const FEATURED_PORTRAITS: FeaturedPortrait[] = [
  { name: "Tom Cruise", profile_path: "/maf8PhSvDCdEwjEMbYfGpojR5RP.jpg" },
  { name: "Meryl Streep", profile_path: "/g5cVxQBAQ3AXt3LhdBXtbbN47Uc.jpg" },
  { name: "Ryan Gosling", profile_path: "/lyUyVARQKhGxaxy0FbPJCQRpiaW.jpg" },
  { name: "Margot Robbie", profile_path: "/euDPyqLnuwaWMHajcU3oZ9uZezR.jpg" },
  { name: "Leonardo DiCaprio", profile_path: "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg" },
  { name: "Denzel Washington", profile_path: "/jj2Gcobpopokal0YstuCQW0ldJ4.jpg" },
  { name: "Brad Pitt", profile_path: "/ajNaPmXVVMJFg9GWmu6MJzTaXdV.jpg" },
  { name: "Sandra Bullock", profile_path: "/4rfjISL3Flx16jfiusXoHbpt87X.jpg" },
  { name: "Demi Moore", profile_path: "/wApParZYBDi4yxekjfxjKEifJYh.jpg" },
  { name: "Timothée Chalamet", profile_path: "/dFxpwRpmzpVfP1zjluH68DeQhyj.jpg" },
  { name: "Emma Stone", profile_path: "/mstXxlDqhoK0s0molsNpskJ1wLH.jpg" },
  { name: "Robert Downey Jr.", profile_path: "/5qHNjhtjMD4YWH3UP0rm4tKwxCL.jpg" },
  { name: "Scarlett Johansson", profile_path: "/tgxYh3jMs5bY2Ub4d2dcp9iaz1R.jpg" },
  { name: "Harrison Ford", profile_path: "/pjBMJVPpcZK23Vt1nzr1zEBTWrP.jpg" },
  { name: "Jennifer Lawrence", profile_path: "/6WTY6HjXMGxnHilJRVC3eLnu43F.jpg" },
  { name: "Pedro Pascal", profile_path: "/oKcMbVn0NJTNzQt0ClKKvVXkm60.jpg" },
  { name: "Cate Blanchett", profile_path: "/vUuEHiAR0eD3XEJhg2DWIjymUAA.jpg" },
  { name: "Mahershala Ali", profile_path: "/9ZmSejm5lnUVY5IJ1iNx2QEjnHb.jpg" },
  { name: "Viola Davis", profile_path: "/xDssw6vpYNRjsybvMPRE30e0dPN.jpg" },
  { name: "Florence Pugh", profile_path: "/2URrZb95t3kY6pLroKny3Enmabp.jpg" },
  { name: "Willem Dafoe", profile_path: "/ui8e4sgZAwMPi3hzEO53jyBJF9B.jpg" },
  { name: "Keanu Reeves", profile_path: "/8RZLOyYGsoRe9p44q3xin9QkMHv.jpg" },
  { name: "Charlize Theron", profile_path: "/gd7ShD0yt4bsR2STeQ19KQ6hvXL.jpg" },
  { name: "Idris Elba", profile_path: "/be1bVF7qGX91a6c5WeRPs5pKXln.jpg" },
  { name: "Rami Malek", profile_path: "/drLMI978uj3Rpc1TcIJarKf3Jfi.jpg" },
  { name: "Saoirse Ronan", profile_path: "/tsk3iKGmMgXIGbRjwf2zYkh8Zkb.jpg" },
  { name: "Daniel Kaluuya", profile_path: "/jj2kZqJobjom36wlhlYhc38nTwN.jpg" },
  { name: "Michelle Yeoh", profile_path: "/i6fHvGt7Rb8oVyjjdQVV6vEHB94.jpg" },
  { name: "Cary Grant", profile_path: "/lcNAirMFcyM7WIiCmaabjbNZVOJ.jpg" },
  { name: "Katharine Hepburn", profile_path: "/hzBSOe6bburyMeeCqD9kR9tRfdD.jpg" },
  { name: "Christopher Nolan", profile_path: "/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg" },
  { name: "Steven Spielberg", profile_path: "/tZxcg19YQ3e8fJ0pOs7hjlnmmr6.jpg" },
  { name: "Martin Scorsese", profile_path: "/g3DjfKsgZQWZiw30I20hZVk1oMX.jpg" },
  { name: "Quentin Tarantino", profile_path: "/1gjcpAa99FAOWGnrUvHEXXsRs7o.jpg" },
  { name: "Greta Gerwig", profile_path: "/dxKAhpkz4XNwmRzMG5QOpXjPZ1N.jpg" },
  { name: "Denis Villeneuve", profile_path: "/xzQYqb4nR8xT7Zdw5itbEL9K3fd.jpg" },
  { name: "Paul Thomas Anderson", profile_path: "/wKAs2LtLYSUzt3ZZ8pnxMwuEWuR.jpg" },
  { name: "Peter Weir", profile_path: "/4GxIZX5gtbMpW4ZgHwvGmLSIHOE.jpg" },
  { name: "Stanley Kubrick", profile_path: "/yFT0VyIelI9aegZrsAwOG5iVP4v.jpg" },
  { name: "Alfred Hitchcock", profile_path: "/108fiNM6poRieMg7RIqLJRxdAwG.jpg" },
];
