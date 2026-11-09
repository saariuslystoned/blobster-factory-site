export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = `https://blobster.dev${url.pathname}${url.search}`;
    return new Response(null, {
      status: 301,
      headers: {
        Location: target,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
